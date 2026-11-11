"""Coordination analytics shared by the Neo4j and in-memory stores.

Both stores produce *pair records* — two accounts on the same IP whose posts share a
hashtag within ``WINDOW_SECONDS`` — and :func:`aggregate_clusters` turns them into the
ranked cluster rows served by ``GET /analytics/clusters`` (docs/07_ANALYTICS.md §4).
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable

from app.schemas.filters import GraphFilters

WINDOW_SECONDS = 3600
HIGH_SEVERITY = 0.7
SEVERITY_BUCKETS = ((0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.0001))

# Risk-score weights (sum = 1). Each factor is normalised to [0, 1].
RISK_WEIGHTS = {"size": 0.30, "tempo": 0.20, "severity": 0.25, "infrastructure": 0.15, "duplication": 0.10}
INFRASTRUCTURE_RISK = {"datacenter": 1.0, "vpn": 0.9, "proxy": 0.9, "residential": 0.3, "corporate": 0.1, "university": 0.1}

CLUSTER_PAIR_QUERY = """
    MATCH (u1:User)-[:POSTED_FROM]->(ip:IPAddress)<-[:POSTED_FROM]-(u2:User)
    WHERE u1.id < u2.id
    MATCH (u1)-[:POSTED]->(p1:Post)-[:MENTIONS]->(h:Hashtag)<-[:MENTIONS]-(p2:Post)<-[:POSTED]-(u2)
    WHERE p1.id <> p2.id
      AND abs(duration.inSeconds(p1.timestamp, p2.timestamp).seconds) <= $window_seconds
      AND {p1} AND {p2}
    RETURN ip.id AS ip_id, ip.address AS cluster_ip, ip.network_type AS network_type,
           h.tag AS hashtag,
           u1.id AS u1_id, u1.handle AS u1_handle, u1.flagged AS u1_flagged,
           u2.id AS u2_id, u2.handle AS u2_handle, u2.flagged AS u2_flagged,
           p1.id AS p1_id, p1.timestamp AS p1_timestamp, p1.severity AS p1_severity,
           p1.text AS p1_text, p1.platform AS p1_platform,
           p2.id AS p2_id, p2.timestamp AS p2_timestamp, p2.severity AS p2_severity,
           p2.text AS p2_text, p2.platform AS p2_platform
"""


def native_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        result = value
    elif hasattr(value, "to_native"):
        result = value.to_native()
    else:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result


def normalize_text(text: str | None) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", re.sub(r"\s+", " ", (text or "").lower())).strip()


def _text_signature(text: str | None) -> str:
    """Coarse near-duplicate key: the sorted set of meaningful words."""
    words = {word for word in normalize_text(text).split() if len(word) > 3}
    return " ".join(sorted(words))


def _jaccard(a: str, b: str) -> float:
    left, right = set(a.split()), set(b.split())
    return len(left & right) / len(left | right) if left and right else 0.0


def duplication_ratio(texts: Iterable[str | None]) -> float:
    """Share of posts whose wording overlaps ≥60% with another post in the set."""
    signatures = [_text_signature(text) for text in texts if text]
    if len(signatures) < 2:
        return 0.0
    duplicated = sum(
        any(_jaccard(sig, other) >= 0.6 for j, other in enumerate(signatures) if j != i)
        for i, sig in enumerate(signatures)
    )
    return duplicated / len(signatures)


def risk_factors(user_count: int, window_minutes: float, avg_severity: float,
                 network_type: str | None, duplication: float) -> dict[str, float]:
    return {
        "size": round(min(user_count, 8) / 8, 3),
        "tempo": round(1 - min(window_minutes, 60) / 60, 3),
        "severity": round(avg_severity, 3),
        "infrastructure": INFRASTRUCTURE_RISK.get((network_type or "").lower(), 0.5),
        "duplication": round(duplication, 3),
    }


def risk_score(factors: dict[str, float]) -> float:
    return round(min(1.0, sum(RISK_WEIGHTS[name] * value for name, value in factors.items())), 3)


def aggregate_clusters(records: Iterable[dict[str, Any]], filters: GraphFilters) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        key = (record["ip_id"], record["hashtag"])
        group = grouped.setdefault(key, {
            "ip_id": record["ip_id"],
            "cluster_ip": record.get("cluster_ip") or record["ip_id"],
            "network_type": record.get("network_type"),
            "hashtag": record["hashtag"],
            "users": {},
            "posts": {},
        })
        for prefix in ("u1", "u2"):
            group["users"][record[f"{prefix}_id"]] = {
                "handle": record.get(f"{prefix}_handle"),
                "flagged": bool(record.get(f"{prefix}_flagged")),
            }
        for prefix in ("p1", "p2"):
            group["posts"][record[f"{prefix}_id"]] = {
                "timestamp": native_datetime(record[f"{prefix}_timestamp"]),
                "severity": float(record.get(f"{prefix}_severity") or 0),
                "text": record.get(f"{prefix}_text"),
                "platform": record.get(f"{prefix}_platform"),
            }

    clusters = []
    for group in grouped.values():
        users, posts = group["users"], group["posts"]
        if len(users) < filters.min_density:
            continue
        times = [post["timestamp"] for post in posts.values()]
        window = (max(times) - min(times)).total_seconds() / 60
        avg_severity = sum(post["severity"] for post in posts.values()) / len(posts)
        factors = risk_factors(len(users), window, avg_severity, group["network_type"],
                               duplication_ratio(post["text"] for post in posts.values()))
        user_ids = sorted(users)
        clusters.append({
            "id": f"{group['ip_id']}:{group['hashtag']}",
            "ip_id": group["ip_id"],
            "cluster_ip": group["cluster_ip"],
            "network_type": group["network_type"],
            "hashtag": group["hashtag"],
            "user_ids": user_ids,
            "user_handles": sorted(user["handle"] for user in users.values() if user["handle"]),
            "flagged_users": sum(user["flagged"] for user in users.values()),
            "post_ids": sorted(posts),
            "platforms": sorted({post["platform"] for post in posts.values() if post["platform"]}),
            "first_seen": min(times).isoformat(),
            "last_seen": max(times).isoformat(),
            "time_window_minutes": round(window, 1),
            "avg_severity": round(avg_severity, 3),
            "risk_factors": factors,
            "risk_score": risk_score(factors),
        })
    return sorted(clusters, key=lambda cluster: (-cluster["risk_score"], cluster["id"]))


def find_coordination_clusters(session, filters: GraphFilters) -> list[dict[str, Any]]:
    query = CLUSTER_PAIR_QUERY.replace("{p1}", filters.post_predicates("p1")).replace(
        "{p2}", filters.post_predicates("p2")
    )
    params = filters.cypher_params()
    params["window_seconds"] = WINDOW_SECONDS
    return aggregate_clusters((dict(record) for record in session.run(query, **params)), filters)


def previous_period(filters: GraphFilters) -> GraphFilters | None:
    """Equal-length window immediately before the current one (for KPI trends)."""
    if not filters.from_date or not filters.to_date:
        return None
    span = (filters.to_date - filters.from_date).days + 1
    return filters.model_copy(update={
        "from_date": filters.from_date - timedelta(days=span),
        "to_date": filters.from_date - timedelta(days=1),
    })


def severity_bucket_label(low: float, high: float) -> str:
    return f"{low:.1f}-{min(high, 1.0):.1f}"


def trend(current: float, previous: float | None) -> dict[str, Any] | None:
    if previous is None:
        return None
    delta = None if previous == 0 else round((current - previous) / previous * 100, 1)
    return {"previous": previous, "delta_pct": delta}


def today_utc() -> date:
    return datetime.now(timezone.utc).date()
