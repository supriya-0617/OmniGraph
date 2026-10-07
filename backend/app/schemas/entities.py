from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field


def _new_id() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UserCreate(BaseModel):
    id: str = Field(default_factory=_new_id)
    handle: str = Field(min_length=1, max_length=100)
    platform: str = Field(min_length=1, max_length=50)
    created_at: datetime = Field(default_factory=_now)
    follower_count: int = Field(default=0, ge=0)
    ip_hash: str | None = Field(default=None, min_length=1)
    flagged: bool = False


class UserUpdate(BaseModel):
    handle: str | None = Field(default=None, min_length=1, max_length=100)
    platform: str | None = Field(default=None, min_length=1, max_length=50)
    created_at: datetime | None = None
    follower_count: int | None = Field(default=None, ge=0)
    ip_hash: str | None = Field(default=None, min_length=1)
    flagged: bool | None = None


class PostCreate(BaseModel):
    id: str = Field(default_factory=_new_id)
    text: str = Field(min_length=1, max_length=10000)
    timestamp: datetime = Field(default_factory=_now)
    platform: str = Field(min_length=1, max_length=50)
    severity: float = Field(ge=0, le=1)
    language: str | None = Field(default=None, max_length=20)
    author_id: str | None = None
    hashtags: list[str] = Field(default_factory=list, max_length=20)


class PostUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=10000)
    timestamp: datetime | None = None
    platform: str | None = Field(default=None, min_length=1, max_length=50)
    severity: float | None = Field(default=None, ge=0, le=1)
    language: str | None = Field(default=None, max_length=20)


class HashtagCreate(BaseModel):
    id: str = Field(default_factory=_new_id)
    tag: str = Field(min_length=1, max_length=100)


class HashtagUpdate(BaseModel):
    tag: str | None = Field(default=None, min_length=1, max_length=100)


class IPAddressCreate(BaseModel):
    id: str = Field(default_factory=_new_id)
    address: str = Field(min_length=1, max_length=100)
    geo_region: str | None = Field(default=None, max_length=100)


class IPAddressUpdate(BaseModel):
    address: str | None = Field(default=None, min_length=1, max_length=100)
    geo_region: str | None = Field(default=None, max_length=100)