from fastapi import APIRouter, Depends, HTTPException, status

from app.analytics import find_coordination_clusters
from app.auth.dependencies import get_current_account
from app.db.memory import memory_store
from app.db.neo4j import db
from app.routes.filters import get_graph_filters
from app.schemas.filters import GraphFilters

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
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


@router.get("/summary")
def get_summary(filters: GraphFilters = Depends(get_graph_filters)):
    if not _ensure_database():
        return memory_store.summary(filters)
    params = filters.cypher_params()
    predicates = filters.post_predicates("p")

    with db.session() as session:
        totals = session.run(
            f"MATCH (p:Post) WHERE {predicates} "
            "RETURN count(p) AS total_posts, avg(p.severity) AS avg_severity",
            **params,
        ).single()
        flagged = session.run(
            "MATCH (u:User)-[:POSTED|RETWEETED]->(p:Post) "
            f"WHERE {predicates} AND u.flagged = true "
            "RETURN count(DISTINCT u) AS total_flagged_users",
            **params,
        ).single()
        posts_over_time = session.run(
            f"MATCH (p:Post) WHERE {predicates} "
            "RETURN toString(date(p.timestamp)) AS bucket, count(p) AS count "
            "ORDER BY bucket",
            **params,
        )
        top_hashtags = session.run(
            f"MATCH (p:Post)-[:MENTIONS]->(h:Hashtag) WHERE {predicates} "
            "RETURN h.tag AS tag, count(DISTINCT p) AS count "
            "ORDER BY count DESC, tag LIMIT 10",
            **params,
        )
        clusters = find_coordination_clusters(session, filters)

    return {
        "total_posts": totals["total_posts"] if totals else 0,
        "total_flagged_users": flagged["total_flagged_users"] if flagged else 0,
        "coordinated_clusters": len(clusters),
        "avg_severity": round(float(totals["avg_severity"] or 0), 3) if totals else 0,
        "posts_over_time": [dict(record) for record in posts_over_time],
        "top_hashtags": [dict(record) for record in top_hashtags],
    }


@router.get("/clusters")
def get_clusters(filters: GraphFilters = Depends(get_graph_filters)):
    if not _ensure_database():
        return memory_store.coordination_clusters(filters)
    with db.session() as session:
        return find_coordination_clusters(session, filters)