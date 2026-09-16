import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Neo4j Settings
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password")

    # Auth Settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-jwt-key-omnigraph-phase1-dev")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # AI Settings
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
