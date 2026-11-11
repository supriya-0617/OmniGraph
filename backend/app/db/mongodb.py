"""MongoDB connection used exclusively for analyst account authentication."""
from __future__ import annotations

import logging
import threading
from typing import Optional

from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.config import settings

logger = logging.getLogger("omnigraph.auth_db")


class MongoAuthDatabase:
    """Reusable MongoDB client for the small, OLTP-style account workload."""

    def __init__(self) -> None:
        self._client: Optional[MongoClient] = None
        self._collection: Optional[Collection] = None
        self._connected = False
        self._last_error: str | None = None
        self._lock = threading.Lock()

    @property
    def is_configured(self) -> bool:
        return bool(settings.MONGODB_URI)

    def connect(self) -> bool:
        if not self.is_configured:
            return False
        with self._lock:
            try:
                if self._client is None:
                    # The API is a low-concurrency long-running service. A
                    # reusable pool avoids reconnecting for every login.
                    self._client = MongoClient(
                        settings.MONGODB_URI,
                        serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
                        connectTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
                        maxPoolSize=10,
                        minPoolSize=0,
                        maxIdleTimeMS=300_000,
                        appname="OmniGraph",
                    )
                self._client.admin.command("ping")
                database = self._client[settings.MONGODB_DATABASE]
                self._collection = database[settings.MONGODB_ACCOUNTS_COLLECTION]
                self._collection.create_index([("email", ASCENDING)], unique=True)
                self._connected = True
                self._last_error = None
                logger.info(
                    "Connected to MongoDB auth database '%s'.",
                    settings.MONGODB_DATABASE,
                )
                return True
            except PyMongoError as error:
                self._connected = False
                self._last_error = str(error)
                logger.warning("MongoDB auth database unavailable: %s", error)
                return False

    def close(self) -> None:
        with self._lock:
            if self._client is not None:
                self._client.close()
            self._client = None
            self._collection = None
            self._connected = False

    def is_connected(self) -> bool:
        return self._connected

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def accounts(self) -> Collection:
        if not self._connected or self._collection is None:
            raise RuntimeError("MongoDB auth database is not connected.")
        return self._collection


mongo_auth_db = MongoAuthDatabase()
