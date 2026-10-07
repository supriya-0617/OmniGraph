import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.neo4j import db
from app.routes import (
    analytics_router,
    auth_router,
    entities_router,
    graph_router,
    health_router,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("omnigraph.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    logger.info("Initializing OmniGraph FastAPI backend...")
    connected = db.connect()
    if connected:
        logger.info("Neo4j database connection established.")
    else:
        logger.warning("Neo4j connection could not be established at startup. Operating with fallback handlers.")
    yield
    logger.info("Shutting down OmniGraph FastAPI backend...")
    db.close()

app = FastAPI(
    title="OmniGraph API",
    description="OSINT & Disinformation Network Analyzer Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for Vite frontend (including alternate dev ports when 5173 is taken)
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(entities_router)
app.include_router(graph_router)
app.include_router(analytics_router)
app.include_router(health_router)

@app.get("/")
def root():
    return {
        "name": "OmniGraph API",
        "description": "OSINT & Disinformation Network Analyzer using GraphRAG",
        "version": "1.0.0",
        "phase": 2,
        "docs": "/docs",
        "health": "/health"
    }
