import logging
import threading
import time
from contextlib import contextmanager
from typing import Optional

from neo4j import Driver, GraphDatabase
from neo4j.exceptions import AuthError, ServiceUnavailable, SessionExpired

from app.config import settings

logger = logging.getLogger("omnigraph.db")


class Neo4jDatabase:
    """Thin wrapper around the Neo4j driver.

    * ``memory mode``  — ``NEO4J_URI`` unset: routes use the in-memory fixture.
    * ``connected``    — driver verified; routes use Neo4j.
    * ``unavailable``  — URI configured but unreachable: routes fail closed with 503
      and the wrapper retries the connection at most every ``NEO4J_RECONNECT_SECONDS``.
    """

    def __init__(self):
        self._driver: Optional[Driver] = None
        self._connected = False
        self._last_attempt = 0.0
        self._last_error: str | None = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ lifecycle
    def connect(self) -> bool:
        if not settings.NEO4J_URI:
            logger.warning("NEO4J_URI not configured — using the in-memory development graph.")
            return False
        with self._lock:
            self._last_attempt = time.monotonic()
            try:
                if self._driver is None:
                    self._driver = GraphDatabase.driver(
                        settings.NEO4J_URI,
                        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                        max_connection_lifetime=240,
                        keep_alive=True,
                        connection_acquisition_timeout=15,
                    )
                with self._driver.session(**self._session_kwargs()) as probe:
                    probe.run("RETURN 1").consume()
                self._connected = True
                self._last_error = None
                logger.info("Connected to Neo4j at %s", settings.NEO4J_URI)
                return True
            except AuthError as error:
                self._mark_unavailable(f"Authentication failed: {error.message}")
            except Exception as error:  # DNS, TLS, paused Aura instance, …
                self._mark_unavailable(str(error))
            return False

    def _mark_unavailable(self, reason: str) -> None:
        self._connected = False
        self._last_error = reason
        logger.warning("Neo4j unavailable: %s", reason)

    def close(self) -> None:
        if self._driver:
            self._driver.close()
            self._driver = None
        self._connected = False

    # ------------------------------------------------------------------ status
    def is_connected(self) -> bool:
        if self._connected or not settings.NEO4J_URI:
            return self._connected
        if time.monotonic() - self._last_attempt >= settings.NEO4J_RECONNECT_SECONDS:
            return self.connect()
        return False

    def is_memory_mode(self) -> bool:
        return not settings.NEO4J_URI

    def storage_mode(self) -> str:
        if self.is_memory_mode():
            return "memory"
        return "neo4j" if self.is_connected() else "neo4j_unavailable"

    @property
    def last_error(self) -> str | None:
        return self._last_error

    # ------------------------------------------------------------------ sessions
    @staticmethod
    def _session_kwargs() -> dict:
        return {"database": settings.NEO4J_DATABASE} if settings.NEO4J_DATABASE else {}

    @contextmanager
    def session(self):
        if not self._driver or not self._connected:
            raise RuntimeError("Neo4j database is not connected.")
        try:
            with self._driver.session(**self._session_kwargs()) as session:
                yield session
        except (ServiceUnavailable, SessionExpired) as error:
            self._mark_unavailable(str(error))
            raise


db = Neo4jDatabase()
