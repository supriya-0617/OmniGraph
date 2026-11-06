import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from neo4j.exceptions import Neo4jError, ServiceUnavailable, SessionExpired

from app.config import settings
from app.db.neo4j import db
from app.routes import (
    ai_router,
    analytics_router,
    auth_router,
    entities_router,
    graph_router,
    health_router,
    public_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("omnigraph.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    problems = settings.validate_for_startup()
    if problems:
        raise RuntimeError("Refusing to start with unsafe production config: " + " ".join(problems))
    if settings.uses_default_jwt_secret:
        logger.warning("Using the default development JWT_SECRET. Set JWT_SECRET before deploying.")
    logger.info("Initializing OmniGraph API (%s)...", settings.ENVIRONMENT)
    if db.connect():
        logger.info("Neo4j connection established.")
    elif not db.is_memory_mode():
        logger.warning("Neo4j is configured but unreachable; data routes return 503 and reconnect automatically.")
    simulator = None
    if settings.SIMULATOR_ENABLED:
        from app.simulator import run_simulator

        simulator = asyncio.create_task(run_simulator(settings.SIMULATOR_INTERVAL_SECONDS))
    yield
    if simulator:
        simulator.cancel()
    db.close()


app = FastAPI(
    title="OmniGraph API",
    description="OSINT & disinformation network analyzer with GraphRAG",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Any localhost port in development (Vite picks a free port when 5173 is busy).
    allow_origin_regex=None if settings.is_production else r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(ServiceUnavailable)
@app.exception_handler(SessionExpired)
async def neo4j_unavailable(_: Request, error: Exception):
    logger.warning("Neo4j unavailable during request: %s", error)
    return JSONResponse(status_code=503, content={"detail": "Configured graph database is unavailable"})


@app.exception_handler(Neo4jError)
async def neo4j_error(_: Request, error: Neo4jError):
    logger.error("Neo4j query error: %s", error)
    return JSONResponse(status_code=500, content={"detail": "Graph database query failed"})


app.include_router(auth_router)
app.include_router(entities_router)
app.include_router(graph_router)
app.include_router(analytics_router)
app.include_router(ai_router)
app.include_router(public_router)
app.include_router(health_router)


@app.get("/")
def root():
    return {
        "name": "OmniGraph API",
        "description": "OSINT & Disinformation Network Analyzer using GraphRAG",
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
    }
