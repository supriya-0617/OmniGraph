import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import RegisterRequest, RegisterResponse, LoginRequest, TokenResponse
from app.auth.jwt import hash_password, verify_password, create_access_token
from app.db.neo4j import db

logger = logging.getLogger("omnigraph.routes.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory user store for explicit database-free development mode.
_in_memory_accounts = {}

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    now_iso = datetime.now(timezone.utc).isoformat()

    if db.is_connected():
        try:
            with db.session() as session:
                # Check if email exists
                check_result = session.run(
                    "MATCH (a:Account {email: $email}) RETURN a.id AS id",
                    email=email
                )
                if check_result.single():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email is already registered"
                    )

                # Create Account node
                create_result = session.run(
                    """
                    CREATE (a:Account {
                        id: $id,
                        email: $email,
                        password_hash: $pw_hash,
                        created_at: datetime($now)
                    })
                    RETURN a.id AS id, a.email AS email
                    """,
                    id=user_id,
                    email=email,
                    pw_hash=pw_hash,
                    now=now_iso
                )
                record = create_result.single()
                if not record:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to create user account"
                    )
                return RegisterResponse(id=record["id"], email=record["email"])
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Neo4j register query error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during registration: {str(e)}"
            )

    if not db.is_memory_mode():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configured graph database is unavailable",
        )

    # Fallback is limited to explicit database-free development mode.
    if email in _in_memory_accounts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    
    _in_memory_accounts[email] = {
        "id": user_id,
        "email": email,
        "password_hash": pw_hash,
        "created_at": now_iso
    }
    logger.info(f"Registered user in fallback memory store: {email}")
    return RegisterResponse(id=user_id, email=email)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    email = req.email.strip().lower()

    if db.is_connected():
        try:
            with db.session() as session:
                result = session.run(
                    "MATCH (a:Account {email: $email}) RETURN a.id AS id, a.email AS email, a.password_hash AS password_hash",
                    email=email
                )
                record = result.single()
                if not record:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password"
                    )
                
                if not verify_password(req.password, record["password_hash"]):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password"
                    )

                access_token = create_access_token(data={"sub": email, "user_id": record["id"]})
                return TokenResponse(
                    access_token=access_token,
                    token_type="bearer",
                    user_email=email
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Neo4j login query error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during login: {str(e)}"
            )

    if not db.is_memory_mode():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configured graph database is unavailable",
        )

    # Fallback is limited to explicit database-free development mode.
    user = _in_memory_accounts.get(email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(data={"sub": email, "user_id": user["id"]})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_email=email
    )
