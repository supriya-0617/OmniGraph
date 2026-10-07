from datetime import datetime, timezone
from typing import Any

from app.schemas.filters import GraphFilters


def _native_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        result = value
    elif hasattr(value, "to_native"):
        result = value.to_native()
    else:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if result.tzinfo is None:
        return result.replace(tzinfo=timezone.utc)
    return result


def find_coordination_clusters(session, filters: GraphFilters) -> list[dict[str, Any]]:
    query = f"""
        MATCH (u1:User)-[:POSTED_FROM]->(ip:IPAddress)<-[:POSTED_FROM]-(u2:User)
        MATCH (u1)-[:POSTED]->(p1:Post)-[:MENTIONS]->(h:Hashtag)
              <-[:MENTIONS]-(p2:Post)<-[:POSTED]-(u2)
        WHERE u1.id < u2.id
          AND p1.id <> p2.id
          AND abs(duration.inSeconds(p1.timestamp, p2.timestamp).seconds) <= $window_seconds
          AND {filters.post_predicates('p1')}
          AND {filters.post_predicates('p2')}
        RETURN ip.id AS ip_id, ip.address AS cluster_ip, h.tag AS hashtag,
               u1.id AS u1_id, u1.handle AS u1_handle,
               u2.id AS u2_id, u2.handle AS u2_handle,
               p1.id AS p1_id, p1.timestamp AS p1_timestamp, p1.severity AS p1_severity,
               p2.id AS p2_id, p2.timestamp AS p2_timestamp, p2.severity AS p2_severity
    """
    params = filters.cypher_params()
    params["window_seconds"] = 3600
    grouped: dict[tuple[str, str], dict[str, Any]] = {}

    for record in session.run(query, **params):
        key = (record["ip_id"], record["hashtag"])
        cluster = grouped.setdefault(
            key,
            {
                "id": f"{record['ip_id']}:{record['hashtag']}",
                "cluster_ip": record["cluster_ip"] or record["ip_id"],
                "hashtag": record["hashtag"],
                "_user_ids": set(),
                "_user_handles": set(),
                "_post_times": {},
                "_post_severities": {},
            },
        )
        cluster["_user_ids"].update((record["u1_id"], record["u2_id"]))
        cluster["_user_handles"].update(
            handle for handle in (record["u1_handle"], record["u2_handle"]) if handle
        )
        for post_id, timestamp, severity in (
            (record["p1_id"], record["p1_timestamp"], record["p1_severity"]),
            (record["p2_id"], record["p2_timestamp"], record["p2_severity"]),
        ):
            cluster["_post_times"][post_id] = _native_datetime(timestamp)
            cluster["_post_severities"][post_id] = float(severity or 0)

    clusters = []
    for cluster in grouped.values():
        user_ids = sorted(cluster.pop("_user_ids"))
        if len(user_ids) < filters.min_density:
            continue
        user_handles = sorted(cluster.pop("_user_handles"))
        post_times = cluster.pop("_post_times")
        severities = cluster.pop("_post_severities")
        time_window = (max(post_times.values()) - min(post_times.values())).total_seconds() / 60
        average_severity = sum(severities.values()) / max(len(severities), 1)
        cluster.update(
            {
                "user_ids": user_ids,
                "user_handles": user_handles,
                "post_ids": sorted(post_times),
                "time_window_minutes": round(time_window, 1),
                "risk_score": round(
                    min(1.0, 0.25 + min(len(user_ids), 5) * 0.1 + average_severity * 0.25),
                    3,
                ),
            }
        )
        clusters.append(cluster)

    return sorted(clusters, key=lambda cluster: cluster["risk_score"], reverse=True)