from fastapi import APIRouter

from app.ai.llm_client import llm_client
from app.config import settings
from app.db.neo4j import db
from app.db.mongodb import mongo_auth_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    mode = db.storage_mode()
    ai = llm_client.status()
    return {
        "status": "online" if mode != "neo4j_unavailable" else "degraded",
        "service": "OmniGraph API",
        "version": "1.1.0",
        "environment": "production" if settings.is_production else "development",
        "database": {
            "connected": mode == "neo4j",
            "type": "Neo4j Aura / Cypher" if mode != "memory" else "In-memory development graph",
        },
        "storage_mode": mode,
        "auth_database": {
            "configured": mongo_auth_db.is_configured,
            "connected": mongo_auth_db.is_connected(),
        },
        "dev_account_enabled": bool(settings.DEV_DEFAULT_ACCOUNT_ENABLED and mode == "memory"),
        "ai": {"configured": ai["configured"], "provider": ai["provider"], "model": ai["model"]},
        "simulator_enabled": settings.SIMULATOR_ENABLED,
    }
