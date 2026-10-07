import logging
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from neo4j.exceptions import ConstraintError

from app.auth.dependencies import get_current_account
from app.db.memory import DuplicateEntityError, MissingEntityError, memory_store
from app.db.neo4j import db
from app.schemas.filters import GraphFilters
from app.schemas.entities import (
    HashtagCreate,
    HashtagUpdate,
    IPAddressCreate,
    IPAddressUpdate,
    PostCreate,
    PostUpdate,
    UserCreate,
    UserUpdate,
)

logger = logging.getLogger("omnigraph.routes.entities")

router = APIRouter(
    prefix="/entities",
    tags=["entities"],
    dependencies=[Depends(get_current_account)],
)


def _ensure_database() -> bool:
    if db.is_connected():
        return True
    if db.is_memory_mode():
        return False
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Configured graph database is unavailable",
    )


def _serialize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "iso_format"):
        return value.iso_format()
    return value


def _list_entities(
    label: str,
    where: str = "true",
    params: dict[str, Any] | None = None,
    offset: int = 0,
    limit: int = 100,
) -> dict[str, Any]:
    query_params = dict(params or {})
    if not _ensure_database():
        return memory_store.list_entities(label, query_params, offset, limit)
    with db.session() as session:
        total_record = session.run(
            f"MATCH (n:{label}) WHERE {where} RETURN count(n) AS total",
            **query_params,
        ).single()
        records = session.run(
            f"MATCH (n:{label}) WHERE {where} "
            "RETURN properties(n) AS item ORDER BY n.id "
            "SKIP $offset LIMIT $limit",
            **query_params,
            offset=offset,
            limit=limit,
        )
        return {
            "items": [_serialize(record["item"]) for record in records],
            "total": total_record["total"] if total_record else 0,
            "offset": offset,
            "limit": limit,
        }


def _get_entity(label: str, entity_id: str) -> dict[str, Any]:
    if not _ensure_database():
        item = memory_store.get_entity(label, entity_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return _serialize(item)
    with db.session() as session:
        record = session.run(
            f"MATCH (n:{label} {{id: $id}}) RETURN properties(n) AS item",
            id=entity_id,
        ).single()
    if not record:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return _serialize(record["item"])


def _create_entity(label: str, properties: dict[str, Any]) -> dict[str, Any]:
    if not _ensure_database():
        try:
            return _serialize(memory_store.create_entity(label, properties))
        except DuplicateEntityError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
    try:
        with db.session() as session:
            record = session.run(
                f"CREATE (n:{label}) SET n = $properties "
                "RETURN properties(n) AS item",
                properties=properties,
            ).single()
    except ConstraintError as error:
        raise HTTPException(status_code=409, detail=f"{label} already exists") from error
    return _serialize(record["item"])


def _update_entity(
    label: str, entity_id: str, properties: dict[str, Any]
) -> dict[str, Any]:
    if not properties:
        raise HTTPException(status_code=422, detail="At least one field is required")
    if not _ensure_database():
        try:
            record = memory_store.update_entity(label, entity_id, properties)
        except DuplicateEntityError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        if not record:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return _serialize(record)
    try:
        with db.session() as session:
            record = session.run(
                f"MATCH (n:{label} {{id: $id}}) "
                "SET n += $properties RETURN properties(n) AS item",
                id=entity_id,
                properties=properties,
            ).single()
    except ConstraintError as error:
        raise HTTPException(status_code=409, detail=f"{label} already exists") from error
    if not record:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return _serialize(record["item"])


def _delete_entity(label: str, entity_id: str) -> dict[str, bool]:
    if not _ensure_database():
        if not memory_store.delete_entity(label, entity_id):
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return {"deleted": True}
    with db.session() as session:
        record = session.run(
            f"MATCH (n:{label} {{id: $id}}) DETACH DELETE n "
            "RETURN count(n) AS deleted",
            id=entity_id,
        ).single()
    if not record or record["deleted"] == 0:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return {"deleted": True}


@router.get("/users")
def list_users(
    platform: str | None = None,
    flagged: bool | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    return _list_entities(
        "User",
        "($platform IS NULL OR n.platform = $platform) "
        "AND ($flagged IS NULL OR n.flagged = $flagged)",
        {"platform": platform, "flagged": flagged},
        offset,
        limit,
    )


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(request: UserCreate):
    properties = request.model_dump()
    ip_id = properties.get("ip_hash")
    if not _ensure_database():
        try:
            return _serialize(memory_store.create_user(properties))
        except DuplicateEntityError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except MissingEntityError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
    try:
        with db.session() as session:
            if ip_id:
                ip_record = session.run(
                    "MATCH (ip:IPAddress {id: $id}) RETURN ip.id AS id", id=ip_id
                ).single()
                if not ip_record:
                    raise HTTPException(status_code=404, detail="IPAddress not found")
            record = session.run(
                "CREATE (n:User) SET n = $properties "
                "RETURN properties(n) AS item",
                properties=properties,
            ).single()
            if ip_id:
                session.run(
                    "MATCH (n:User {id: $user_id}), (ip:IPAddress {id: $ip_id}) "
                    "MERGE (n)-[r:POSTED_FROM]->(ip) "
                    "SET r.timestamp = n.created_at",
                    user_id=request.id,
                    ip_id=ip_id,
                )
    except ConstraintError as error:
        raise HTTPException(status_code=409, detail="User already exists") from error
    return _serialize(record["item"])


@router.get("/users/{entity_id}")
def get_user(entity_id: str):
    return _get_entity("User", entity_id)


@router.put("/users/{entity_id}")
def update_user(entity_id: str, request: UserUpdate):
    updates = request.model_dump(exclude_unset=True)
    if not _ensure_database():
        try:
            record = memory_store.update_entity("User", entity_id, updates)
        except MissingEntityError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        if not record:
            raise HTTPException(status_code=404, detail="User not found")
        return _serialize(record)
    if "ip_hash" not in updates:
        properties = {key: value for key, value in updates.items() if value is not None}
        return _update_entity("User", entity_id, properties)

    ip_id = updates.pop("ip_hash")
    properties = {key: value for key, value in updates.items() if value is not None}
    _ensure_database()
    with db.session() as session:
        if ip_id:
            ip_record = session.run(
                "MATCH (ip:IPAddress {id: $id}) RETURN ip.id AS id", id=ip_id
            ).single()
            if not ip_record:
                raise HTTPException(status_code=404, detail="IPAddress not found")
        record = session.run(
            "MATCH (n:User {id: $id}) "
            "OPTIONAL MATCH (n)-[old:POSTED_FROM]->(:IPAddress) "
            "WITH n, collect(old) AS old_relationships "
            "FOREACH (relationship IN old_relationships | DELETE relationship) "
            "SET n += $properties SET n.ip_hash = $ip_id "
            "WITH n OPTIONAL MATCH (ip:IPAddress {id: $ip_id}) "
            "FOREACH (_ IN CASE WHEN ip IS NULL THEN [] ELSE [1] END | "
            "MERGE (n)-[r:POSTED_FROM]->(ip) SET r.timestamp = n.created_at) "
            "RETURN properties(n) AS item",
            id=entity_id,
            ip_id=ip_id,
            properties=properties,
        ).single()
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize(record["item"])


@router.delete("/users/{entity_id}")
def delete_user(entity_id: str):
    return _delete_entity("User", entity_id)


@router.get("/posts")
def list_posts(
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = None,
    platform: str | None = None,
    min_severity: float | None = Query(default=None, ge=0, le=1),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    filters = GraphFilters(
        from_date=from_,
        to_date=to,
        platform=platform,
        min_severity=min_severity or 0,
    )
    filter_params = filters.cypher_params()
    where = (
        "($from IS NULL OR n.timestamp >= $from) "
        "AND ($to IS NULL OR n.timestamp <= $to) "
        "AND ($platform IS NULL OR n.platform = $platform) "
        "AND ($min_severity IS NULL OR n.severity >= $min_severity)"
    )
    return _list_entities(
        "Post",
        where,
        {
            "from": filter_params["from_date"],
            "to": filter_params["to_date"],
            "platform": filter_params["platform"],
            "min_severity": min_severity,
        },
        offset,
        limit,
    )


@router.post("/posts", status_code=status.HTTP_201_CREATED)
def create_post(request: PostCreate):
    properties = request.model_dump(exclude={"author_id", "hashtags"})
    if not _ensure_database():
        try:
            return _serialize(
                memory_store.create_post(properties, request.author_id, request.hashtags)
            )
        except DuplicateEntityError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except MissingEntityError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
    try:
        with db.session() as session:
            if request.author_id:
                author = session.run(
                    "MATCH (u:User {id: $id}) RETURN u.id AS id",
                    id=request.author_id,
                ).single()
                if not author:
                    raise HTTPException(status_code=404, detail="User not found")
            record = session.run(
                "CREATE (n:Post) SET n = $properties "
                "RETURN properties(n) AS item",
                properties=properties,
            ).single()
            if request.author_id:
                session.run(
                    "MATCH (u:User {id: $user_id}), (p:Post {id: $post_id}) "
                    "MERGE (u)-[r:POSTED]->(p) SET r.timestamp = p.timestamp",
                    user_id=request.author_id,
                    post_id=request.id,
                )
            if request.hashtags:
                session.run(
                    "MATCH (p:Post {id: $post_id}) "
                    "UNWIND $tags AS tag "
                    "MERGE (h:Hashtag {tag: tag}) "
                    "ON CREATE SET h.id = randomUUID() "
                    "MERGE (p)-[:MENTIONS]->(h)",
                    post_id=request.id,
                    tags=list(dict.fromkeys(request.hashtags)),
                )
    except ConstraintError as error:
        raise HTTPException(status_code=409, detail="Post already exists") from error
    return _serialize(record["item"])


@router.get("/posts/{entity_id}")
def get_post(entity_id: str):
    return _get_entity("Post", entity_id)


@router.put("/posts/{entity_id}")
def update_post(entity_id: str, request: PostUpdate):
    return _update_entity("Post", entity_id, request.model_dump(exclude_unset=True, exclude_none=True))


@router.delete("/posts/{entity_id}")
def delete_post(entity_id: str):
    return _delete_entity("Post", entity_id)


@router.get("/hashtags")
def list_hashtags(
    offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=500)
):
    return _list_entities("Hashtag", offset=offset, limit=limit)


@router.post("/hashtags", status_code=status.HTTP_201_CREATED)
def create_hashtag(request: HashtagCreate):
    return _create_entity("Hashtag", request.model_dump())


@router.get("/hashtags/{entity_id}")
def get_hashtag(entity_id: str):
    return _get_entity("Hashtag", entity_id)


@router.put("/hashtags/{entity_id}")
def update_hashtag(entity_id: str, request: HashtagUpdate):
    return _update_entity("Hashtag", entity_id, request.model_dump(exclude_unset=True, exclude_none=True))


@router.delete("/hashtags/{entity_id}")
def delete_hashtag(entity_id: str):
    return _delete_entity("Hashtag", entity_id)


@router.get("/ips")
def list_ips(
    offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=500)
):
    return _list_entities("IPAddress", offset=offset, limit=limit)


@router.post("/ips", status_code=status.HTTP_201_CREATED)
def create_ip(request: IPAddressCreate):
    return _create_entity("IPAddress", request.model_dump())


@router.get("/ips/{entity_id}")
def get_ip(entity_id: str):
    return _get_entity("IPAddress", entity_id)


@router.put("/ips/{entity_id}")
def update_ip(entity_id: str, request: IPAddressUpdate):
    return _update_entity("IPAddress", entity_id, request.model_dump(exclude_unset=True, exclude_none=True))


@router.delete("/ips/{entity_id}")
def delete_ip(entity_id: str):
    return _delete_entity("IPAddress", entity_id)