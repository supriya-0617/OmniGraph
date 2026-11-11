import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import AccountResponse, RegisterRequest, RegisterResponse, LoginRequest, TokenResponse
from app.auth.dependencies import get_current_account
from app.auth.jwt import hash_password, verify_password, create_access_token
from app.db.neo4j import db
from app.db.mongodb import mongo_auth_db
from pymongo.errors import DuplicateKeyError, PyMongoError
from app.config import settings

logger = logging.getLogger("omnigraph.routes.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory user store for explicit database-free development mode.
_in_memory_accounts = {}
_DEV_USERNAME = "1234"
_DEV_PASSWORD = "1234"
_DEV_EMAIL = "1234@local.dev"

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    now_iso = datetime.now(timezone.utc).isoformat()

    if mongo_auth_db.is_configured:
        if not mongo_auth_db.is_connected():
            mongo_auth_db.connect()
        if not mongo_auth_db.is_connected():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MongoDB authentication database is unavailable.",
            )
        try:
            mongo_auth_db.accounts.insert_one(
                {
                    "id": user_id,
                    "email": email,
                    "password_hash": pw_hash,
                    "created_at": now_iso,
                }
            )
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered",
            )
        except PyMongoError as error:
            logger.exception("MongoDB register query error: %s", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Registration is temporarily unavailable. Please try again.",
            ) from error
        return RegisterResponse(id=user_id, email=email)

    if db.is_memory_mode():
        # Database-free development remains available when MongoDB is not configured.
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
        logger.info("Registered user in fallback memory store: %s", email)
        return RegisterResponse(id=user_id, email=email)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="MongoDB authentication database is not configured.",
    )

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    identifier = req.email.strip().lower()

    if (
        settings.DEV_DEFAULT_ACCOUNT_ENABLED
        and db.is_memory_mode()
        and not mongo_auth_db.is_configured
        and identifier == _DEV_USERNAME
        and req.password == _DEV_PASSWORD
    ):
        access_token = create_access_token(data={"sub": _DEV_USERNAME, "user_id": "dev-account-1234"})
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user_email=_DEV_USERNAME,
        )

    email = identifier

    if mongo_auth_db.is_configured:
        if not mongo_auth_db.is_connected():
            mongo_auth_db.connect()
        if not mongo_auth_db.is_connected():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MongoDB authentication database is unavailable.",
            )
        try:
            record = mongo_auth_db.accounts.find_one(
                {"email": email},
                {"_id": 0, "id": 1, "email": 1, "password_hash": 1},
            )
        except PyMongoError as error:
            logger.exception("MongoDB login query error: %s", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Sign-in is temporarily unavailable. Please try again.",
            ) from error
        if not record or not verify_password(req.password, record["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        access_token = create_access_token(data={"sub": email, "user_id": record["id"]})
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user_email=email,
        )

    if db.is_memory_mode():
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

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="MongoDB authentication database is not configured.",
    )

@router.get("/me", response_model=AccountResponse)
def me(account: dict = Depends(get_current_account)):
    """Validate a stored token and return the signed-in analyst (used to restore sessions)."""
    return AccountResponse(id=str(account["user_id"]), email=str(account["sub"]), expires_at=int(account.get("exp", 0)))
