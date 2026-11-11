"""Live coordination walkthrough: inject a fresh coordinated burst (docs/08_API_SPEC.md).

The burst comes from ``app.data.synthetic.demo_burst`` so memory mode and Neo4j receive
identical data. Every post is prefixed "[DEMO]" and every ID with ``demo_`` so injected
data is distinguishable from the seeded dataset and can be removed with one query.
"""
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from neo4j.exceptions import ConstraintError
from pydantic import BaseModel

from app.auth.dependencies import get_current_account
from app.data.synthetic import demo_burst
from app.db.memory import memory_store
from app.db.neo4j import db

router = APIRouter(
    prefix="/demo",
    tags=["demo"],
    dependencies=[Depends(get_current_account)],
)


class CoordinationDemoResult(BaseModel):
    scenario_id: str
    shared_ip: str
    hashtag: str
    platform: str
    accounts_created: int
    posts_created: int
    window_seconds: int
    user_ids: list[str]
    post_ids: list[str]


EDGE_ENDPOINTS = {
    "POSTED_FROM": ("User", "IPAddress"),
    "POSTED": ("User", "Post"),
    "MENTIONS": ("Post", "Hashtag"),
    "RETWEETED": ("User", "Post"),
}


def _write_burst(transaction, burst: dict[str, Any]) -> None:
    transaction.run("CREATE (ip:IPAddress) SET ip = $ip", ip=burst["ip"]).consume()
    transaction.run("CREATE (h:Hashtag) SET h = $hashtag", hashtag=burst["hashtag"]).consume()
    transaction.run("UNWIND $rows AS row CREATE (u:User) SET u = row", rows=burst["users"]).consume()
    transaction.run("UNWIND $rows AS row CREATE (p:Post) SET p = row", rows=burst["posts"]).consume()
    for relation, (source_label, target_label) in EDGE_ENDPOINTS.items():
        rows = [
            {"source": edge["source"], "target": edge["target"], "props": edge["properties"]}
            for edge in burst["edges"]
            if edge["type"] == relation
        ]
        transaction.run(
            f"UNWIND $rows AS row "
            f"MATCH (a:{source_label} {{id: row.source}}) MATCH (b:{target_label} {{id: row.target}}) "
            f"CREATE (a)-[r:{relation}]->(b) SET r = row.props",
            rows=rows,
        ).consume()


@router.post("/coordination", response_model=CoordinationDemoResult, status_code=status.HTTP_201_CREATED)
def create_coordination_demo(
    platform: Literal["X", "Telegram", "Facebook"] = Query(default="X"),
):
    if not db.is_connected():
        if not db.is_memory_mode():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Configured graph database is unavailable",
            )
        return memory_store.create_demo_burst(platform)

    burst = demo_burst(platform)
    try:
        with db.session() as session:
            session.execute_write(_write_burst, burst)
    except ConstraintError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The demo scenario could not be inserted because an entity already exists",
        ) from error
    return burst["result"]
