"""Central runtime configuration.

Values are read from the process environment first, then from ``backend/.env``
(resolved relative to this file so the API behaves the same no matter which
directory uvicorn is launched from).
"""
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_JWT_SECRET = "omnigraph-local-development-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str = "development"

    # Neo4j / Aura. Aura credential downloads use NEO4J_USERNAME; older docs used NEO4J_USER.
    NEO4J_URI: str = ""
    NEO4J_USER: str = Field(
        default="neo4j", validation_alias=AliasChoices("NEO4J_USERNAME", "NEO4J_USER")
    )
    NEO4J_PASSWORD: str = ""
    NEO4J_DATABASE: str = ""
    NEO4J_RECONNECT_SECONDS: float = 15.0

    # Auth
    JWT_SECRET: str = _DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DEV_DEFAULT_ACCOUNT_ENABLED: bool = True

    # HTTP
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # GraphRAG / LLM — see app/ai/llm_client.py for the provider matrix.
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""
    LLM_BASE_URL: str = ""
    LLM_TIMEOUT_SECONDS: float = 45.0
    LLM_MAX_OUTPUT_TOKENS: int = 8192
    VERTEX_PROJECT_ID: str = ""
    VERTEX_LOCATION: str = "global"
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    AI_RATE_LIMIT_PER_MINUTE: int = 8

    # Optional simulated live stream (docs/05_DATA_PIPELINE.md §4)
    SIMULATOR_ENABLED: bool = False
    SIMULATOR_INTERVAL_SECONDS: float = 20.0

    @field_validator("NEO4J_URI", "NEO4J_PASSWORD", "LLM_API_KEY", "LLM_MODEL", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def uses_default_jwt_secret(self) -> bool:
        return self.JWT_SECRET in {
            _DEFAULT_JWT_SECRET,
            "super-secret-jwt-key-change-in-production-32-chars-min",
            "super-secret-jwt-key-omnigraph-phase1-dev",
        }

    def validate_for_startup(self) -> list[str]:
        """Return fatal configuration problems (only enforced in production)."""
        problems = []
        if self.is_production:
            if self.uses_default_jwt_secret or len(self.JWT_SECRET) < 32:
                problems.append("JWT_SECRET must be a unique value of at least 32 characters in production.")
            if self.DEV_DEFAULT_ACCOUNT_ENABLED:
                problems.append("DEV_DEFAULT_ACCOUNT_ENABLED must be false in production.")
            if not self.NEO4J_URI:
                problems.append("NEO4J_URI is required in production (memory mode is for development only).")
        return problems


settings = Settings()
