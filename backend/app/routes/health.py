from fastapi import APIRouter
from app.db.neo4j import db

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check():
    connected = db.is_connected()
    return {
        "status": "online",
        "service": "OmniGraph API",
        "version": "1.0.0",
        "phase": 2,
        "database": {
            "connected": connected,
            "type": "Neo4j Aura / Cypher"
        },
        "storage_mode": "neo4j" if connected else "memory" if db.is_memory_mode() else "neo4j_unavailable",
    }
