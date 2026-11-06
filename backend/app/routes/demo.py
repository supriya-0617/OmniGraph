from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from neo4j.exceptions import ConstraintError
from pydantic import BaseModel

from app.auth.dependencies import get_current_account
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


def _write_burst(transaction, *, scenario_id: str, platform: str, created_at: datetime) -> dict[str, Any]:
    ip_id = f"demo_ip_{scenario_id}"
    hashtag_id = f"demo_tag_{scenario_id}"
    hashtag = f"#DemoBurst{scenario_id}"
    address = f"192.0.2.{1 + int(scenario_id[:4], 16) % 254}"
    accounts = [
        {
            "user_id": f"demo_user_{scenario_id}_{index + 1:02d}",
            "handle": f"@demo_{scenario_id}_{index + 1:02d}",
            "post_id": f"demo_post_{scenario_id}_{index + 1:02d}",
            "timestamp": created_at + timedelta(seconds=index * 5),
        }
        for index in range(10)
    ]
    record = transaction.run(
        "CREATE (ip:IPAddress {id: $ip_id, address: $address, "
        "geo_region: 'SIMULATED-NETWORK'}) "
        "CREATE (h:Hashtag {id: $hashtag_id, tag: $hashtag}) "
        "WITH ip, h UNWIND $accounts AS account "
        "CREATE (u:User {id: account.user_id, handle: account.handle, "
        "platform: $platform, created_at: $created_at, follower_count: 0, "
        "ip_hash: $ip_id, flagged: true}) "
        "CREATE (p:Post {id: account.post_id, "
        "text: 'DEMO: repeat signal for coordinated-activity walkthrough.', "
        "timestamp: account.timestamp, platform: $platform, severity: 1.0, language: 'en'}) "
        "CREATE (u)-[:POSTED_FROM {timestamp: $created_at}]->(ip) "
        "CREATE (u)-[:POSTED {timestamp: account.timestamp}]->(p) "
        "CREATE (p)-[:MENTIONS]->(h) "
        "RETURN count(DISTINCT u) AS accounts_created, count(DISTINCT p) AS posts_created",
        ip_id=ip_id,
        address=address,
        hashtag_id=hashtag_id,
        hashtag=hashtag,
        accounts=accounts,
        platform=platform,
        created_at=created_at,
    ).single()
    return {
        "scenario_id": scenario_id,
        "shared_ip": address,
        "hashtag": hashtag,
        "platform": platform,
        "accounts_created": record["accounts_created"],
        "posts_created": record["posts_created"],
        "window_seconds": 45,
        "user_ids": [account["user_id"] for account in accounts],
        "post_ids": [account["post_id"] for account in accounts],
    }


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

    scenario_id = uuid4().hex[:10]
    try:
        with db.session() as session:
            return session.execute_write(
                _write_burst,
                scenario_id=scenario_id,
                platform=platform,
                created_at=datetime.now(timezone.utc),
            )
    except ConstraintError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The demo scenario could not be inserted because an entity already exists",
        ) from error