"""Optional simulated live stream (docs/05_DATA_PIPELINE.md §4).

Enable with ``SIMULATOR_ENABLED=true``. Every ``SIMULATOR_INTERVAL_SECONDS`` it appends a
couple of organic posts from existing accounts to the active store, so the dashboard
reflects a moving feed. It never creates accounts and is capped per process lifetime.
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone

from app.data.synthetic import live_posts
from app.db.memory import memory_store
from app.db.neo4j import db

logger = logging.getLogger("omnigraph.simulator")
MAX_POSTS_PER_RUN = 5000

INSERT_POST = """
MATCH (u:User {id: $author_id})
MERGE (p:Post {id: $id})
SET p.text = $text, p.timestamp = datetime($timestamp), p.platform = u.platform,
    p.severity = $severity, p.language = $language
MERGE (u)-[r:POSTED]->(p) SET r.timestamp = p.timestamp
WITH p
UNWIND $hashtags AS tag
MERGE (h:Hashtag {tag: tag}) ON CREATE SET h.id = randomUUID()
MERGE (p)-[:MENTIONS]->(h)
"""


def _user_ids() -> list[str]:
    if db.is_memory_mode():
        return [item["id"] for item in memory_store.list_entities("User", limit=500)["items"] if not item.get("flagged")]
    if not db.is_connected():
        return []
    with db.session() as session:
        return [r["id"] for r in session.run("MATCH (u:User) WHERE coalesce(u.flagged, false) = false RETURN u.id AS id LIMIT 500")]


def emit_once(rng: random.Random) -> int:
    users = _user_ids()
    if not users:
        return 0
    posts = live_posts(datetime.now(timezone.utc), rng, users, count=rng.randint(1, 3))
    for post in posts:
        if db.is_memory_mode():
            author = memory_store.get_entity("User", post["author_id"]) or {}
            memory_store.create_post(
                {key: post[key] for key in ("id", "text", "timestamp", "severity", "language")}
                | {"platform": author.get("platform", "X")},
                post["author_id"],
                post["hashtags"],
            )
        else:
            with db.session() as session:
                session.run(INSERT_POST, **{**post, "timestamp": post["timestamp"].isoformat()})
    return len(posts)


async def run_simulator(interval: float) -> None:
    rng = random.Random()
    emitted = 0
    logger.info("Live stream simulator started (every %.0fs)", interval)
    while emitted < MAX_POSTS_PER_RUN:
        await asyncio.sleep(interval)
        try:
            emitted += await asyncio.to_thread(emit_once, rng)
        except Exception as error:  # keep the loop alive through transient DB errors
            logger.warning("Simulator tick failed: %s", error)
    logger.info("Simulator reached its cap of %d posts and stopped", MAX_POSTS_PER_RUN)
