"""Analytics routes (docs/07_ANALYTICS.md). Cypher is documented in docs/04_GRAPH_SCHEMA.md §5."""
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.analytics import (
    HIGH_SEVERITY,
    SEVERITY_BUCKETS,
    find_coordination_clusters,
    previous_period,
    severity_bucket_label,
    trend,
)
from app.auth.dependencies import get_current_account
from app.db.memory import TREND_KEYS, memory_store
from app.db.neo4j import db
from app.routes.filters import get_graph_filters
from app.schemas.analytics import AnalyticsSummary, CoordinatedCluster, PublicStats
from app.schemas.filters import GraphFilters

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_account)],
)
public_router = APIRouter(prefix="/public", tags=["public"])


def _ensure_database() -> bool:
    if db.is_connected():
        return True
    if db.is_memory_mode():
        return False
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Configured graph database is unavailable",
    )


SUMMARY_QUERY = """
MATCH (p:Post)
WHERE {predicates} AND ($post_ids IS NULL OR p.id IN $post_ids)
WITH collect(p) AS posts
CALL {
  WITH posts
  UNWIND posts AS p
  RETURN count(p) AS total_posts, avg(p.severity) AS avg_severity,
         sum(CASE WHEN p.severity >= $high THEN 1 ELSE 0 END) AS high_severity_posts
}
CALL {
  WITH posts
  UNWIND posts AS p
  OPTIONAL MATCH (u:User)-[r:POSTED|RETWEETED]->(p)
  RETURN count(DISTINCT CASE WHEN type(r) = 'POSTED' THEN u END) AS total_accounts,
         count(DISTINCT CASE WHEN u.flagged = true THEN u END) AS total_flagged_users
}
CALL {
  WITH posts
  UNWIND posts AS p
  WITH toString(date(p.timestamp)) AS bucket, p
  RETURN collect({bucket: bucket, count: 1, high: CASE WHEN p.severity >= $high THEN 1 ELSE 0 END}) AS day_rows
}
CALL {
  WITH posts
  UNWIND posts AS p
  MATCH (p)-[:MENTIONS]->(h:Hashtag)
  WITH h.tag AS tag, count(DISTINCT p) AS count ORDER BY count DESC, tag LIMIT 10
  RETURN collect({tag: tag, count: count}) AS top_hashtags
}
CALL {
  WITH posts
  UNWIND posts AS p
  WITH coalesce(p.platform, 'Unknown') AS platform, count(p) AS count ORDER BY count DESC, platform
  RETURN collect({platform: platform, count: count}) AS platform_breakdown
}
RETURN total_posts, avg_severity, high_severity_posts, total_accounts, total_flagged_users,
       day_rows, top_hashtags, platform_breakdown, [p IN posts | p.severity] AS severities
"""


def _neo4j_summary_core(session, filters: GraphFilters) -> dict[str, Any]:
    clusters = find_coordination_clusters(session, filters)
    post_ids = None
    if filters.min_density > 1:
        post_ids = sorted({post_id for cluster in clusters for post_id in cluster["post_ids"]})
    params = filters.cypher_params()
    params.update({"post_ids": post_ids, "high": HIGH_SEVERITY})
    record = session.run(
        SUMMARY_QUERY.replace("{predicates}", filters.post_predicates("p")), **params
    ).single()

    days: dict[str, dict[str, int]] = {}
    for row in (record["day_rows"] if record else []):
        day = days.setdefault(row["bucket"], {"count": 0, "high_severity": 0})
        day["count"] += row["count"]
        day["high_severity"] += row["high"]
    buckets = [0] * len(SEVERITY_BUCKETS)
    for severity in (record["severities"] if record else []):
        for index, (low, high) in enumerate(SEVERITY_BUCKETS):
            if low <= float(severity or 0) < high:
                buckets[index] += 1
                break
    return {
        "total_posts": record["total_posts"] if record else 0,
        "total_accounts": record["total_accounts"] if record else 0,
        "total_flagged_users": record["total_flagged_users"] if record else 0,
        "coordinated_clusters": len(clusters),
        "high_severity_posts": record["high_severity_posts"] if record else 0,
        "avg_severity": round(float(record["avg_severity"] or 0), 3) if record else 0,
        "posts_over_time": [{"bucket": bucket, **counts} for bucket, counts in sorted(days.items())],
        "top_hashtags": list(record["top_hashtags"]) if record else [],
        "platform_breakdown": list(record["platform_breakdown"]) if record else [],
        "severity_distribution": [
            {"range": severity_bucket_label(low, high), "count": buckets[index]}
            for index, (low, high) in enumerate(SEVERITY_BUCKETS)
        ],
    }


def compute_summary(filters: GraphFilters) -> dict[str, Any]:
    if not _ensure_database():
        return memory_store.summary(filters)
    previous_filters = previous_period(filters)
    with db.session() as session:
        summary = _neo4j_summary_core(session, filters)
        previous = _neo4j_summary_core(session, previous_filters) if previous_filters else None
    summary["trends"] = (
        {key: trend(summary[key], previous[key]) for key in TREND_KEYS} if previous else None
    )
    summary["density_scoped"] = filters.min_density > 1
    return summary


def compute_clusters(filters: GraphFilters) -> list[dict[str, Any]]:
    if not _ensure_database():
        return memory_store.coordination_clusters(filters)
    with db.session() as session:
        return find_coordination_clusters(session, filters)


@router.get("/summary", response_model=AnalyticsSummary)
def get_summary(filters: GraphFilters = Depends(get_graph_filters)):
    return compute_summary(filters)


@router.get("/clusters", response_model=list[CoordinatedCluster])
def get_clusters(filters: GraphFilters = Depends(get_graph_filters)):
    return compute_clusters(filters)


_stats_cache: dict[str, Any] = {"at": 0.0, "value": None}
STATS_TTL_SECONDS = 60


@public_router.get("/stats", response_model=PublicStats)
def public_stats():
    """Aggregate counts for the landing page. Exposes no handles, text or addresses. Cached 60s."""
    mode = db.storage_mode()
    cached = _stats_cache["value"]
    if cached and cached["storage_mode"] == mode and time.monotonic() - _stats_cache["at"] < STATS_TTL_SECONDS:
        return cached
    if mode == "memory":
        entities = memory_store.count_entities()
    elif mode == "neo4j":
        with db.session() as session:
            entities = {
                label: session.run(f"MATCH (n:{label}) RETURN count(n) AS c").single()["c"]
                for label in ("User", "Post", "Hashtag", "IPAddress")
            }
    else:
        raise HTTPException(status_code=503, detail="Configured graph database is unavailable")
    value = {
        "storage_mode": mode,
        "entities": entities,
        "coordinated_clusters": len(compute_clusters(GraphFilters(min_density=3))),
    }
    _stats_cache.update(at=time.monotonic(), value=value)
    return value
