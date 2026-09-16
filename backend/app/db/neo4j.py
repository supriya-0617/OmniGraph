import logging
from typing import Optional, Generator
from neo4j import GraphDatabase, Driver, Session
from app.config import settings

logger = logging.getLogger("omnigraph.db")

class Neo4jDatabase:
    def __init__(self):
        self._driver: Optional[Driver] = None
        self._connected: bool = False

    def connect(self) -> bool:
        """Initialize driver and verify connectivity to Neo4j."""
        if not settings.NEO4J_URI or settings.NEO4J_URI == "bolt://localhost:7687" and not settings.NEO4J_PASSWORD:
            logger.warning("Neo4j URI or credentials not configured. DB operations will fall back to local handler.")
            return False

        try:
            auth = (settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            self._driver = GraphDatabase.driver(settings.NEO4J_URI, auth=auth)
            self._driver.verify_connectivity()
            self._connected = True
            logger.info(f"Successfully connected to Neo4j at {settings.NEO4J_URI}")
            return True
        except Exception as e:
            logger.warning(f"Could not connect to Neo4j at {settings.NEO4J_URI}: {e}")
            self._connected = False
            return False

    def close(self):
        """Close the Neo4j driver connection."""
        if self._driver:
            self._driver.close()
            self._connected = False
            logger.info("Neo4j connection closed.")

    def is_connected(self) -> bool:
        return self._connected

    def get_session(self) -> Generator[Session, None, None]:
        """Provide a Neo4j session context manager."""
        if not self._driver or not self._connected:
            raise RuntimeError("Neo4j database is not connected.")
        session = self._driver.session()
        try:
            yield session
        finally:
            session.close()

db = Neo4jDatabase()
