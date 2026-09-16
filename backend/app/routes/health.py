from fastapi import APIRouter
from app.db.neo4j import db

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "OmniGraph API",
        "version": "1.0.0",
        "phase": 1,
        "database": {
            "connected": db.is_connected(),
            "type": "Neo4j Aura / Cypher"
        }
    }
