from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.analytics import find_coordination_clusters
from app.auth.dependencies import get_current_account
from app.db.memory import memory_store
from app.db.neo4j import db
from app.routes.filters import get_graph_filters
from app.schemas.filters import GraphFilters

router = APIRouter(
    prefix="/graph",
    tags=["graph"],
    dependencies=[Depends(get_current_account)],
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


@router.get("")
def get_graph(filters: GraphFilters = Depends(get_graph_filters)):
    if not db.is_connected():
        if not db.is_memory_mode():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Configured graph database is unavailable",
            )
        return memory_store.graph(filters)

    with db.session() as session:
        eligible_post_ids = None
        if filters.min_density > 1:
            clusters = find_coordination_clusters(session, filters)
            eligible_post_ids = sorted(
                {post_id for cluster in clusters for post_id in cluster["post_ids"]}
            )
            if not eligible_post_ids:
                return {"nodes": [], "edges": []}

        query = f"""
            MATCH (p:Post)
            WHERE {filters.post_predicates('p')}
              AND ($post_ids IS NULL OR p.id IN $post_ids)
            WITH p ORDER BY p.timestamp DESC LIMIT $post_limit
            OPTIONAL MATCH (u:User)-[authored:POSTED|RETWEETED]->(p)
            OPTIONAL MATCH (p)-[mentioned:MENTIONS]->(h:Hashtag)
            OPTIONAL MATCH (u)-[posted_from:POSTED_FROM]->(ip:IPAddress)
            RETURN properties(p) AS post,
                   properties(u) AS user, type(authored) AS author_type,
                   properties(authored) AS author_edge,
                   properties(h) AS hashtag, properties(mentioned) AS mention_edge,
                   properties(ip) AS ip, properties(posted_from) AS ip_edge
        """
        params = filters.cypher_params()
        params.update({"post_ids": eligible_post_ids, "post_limit": 120})
        records = session.run(query, **params)

        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[tuple[str, str, str], dict[str, Any]] = {}

        def add_node(label: str, properties: dict[str, Any] | None) -> None:
            if not properties or not properties.get("id"):
                return
            node_id = str(properties["id"])
            nodes[node_id] = {
                "id": node_id,
                "label": label,
                "props": _serialize(properties),
            }

        def add_edge(
            source: str | None,
            target: str | None,
            relation: str | None,
            properties: dict[str, Any] | None = None,
        ) -> None:
            if not source or not target or not relation:
                return
            edge = {"source": str(source), "target": str(target), "type": relation}
            if properties and properties.get("timestamp") is not None:
                edge["timestamp"] = _serialize(properties["timestamp"])
            edges[(edge["source"], edge["target"], relation)] = edge

        for record in records:
            post = record["post"]
            user = record["user"]
            hashtag = record["hashtag"]
            ip = record["ip"]
            add_node("Post", post)
            add_node("User", user)
            add_node("Hashtag", hashtag)
            add_node("IPAddress", ip)
            if user and post:
                add_edge(user.get("id"), post.get("id"), record["author_type"], record["author_edge"])
            if post and hashtag:
                add_edge(post.get("id"), hashtag.get("id"), "MENTIONS", record["mention_edge"])
            if user and ip:
                add_edge(user.get("id"), ip.get("id"), "POSTED_FROM", record["ip_edge"])

        post_ids = [node_id for node_id, node in nodes.items() if node["label"] == "Post"]
        if post_ids:
            related_records = session.run(
                "MATCH (source)-[relation]->(target) "
                "WHERE type(relation) IN ['REPLIED_TO', 'TAGGED_USER'] "
                "AND ((source:Post AND source.id IN $post_ids) "
                "OR (target:Post AND target.id IN $post_ids)) "
                "AND (type(relation) <> 'REPLIED_TO' "
                "OR (source:Post AND source.id IN $post_ids "
                "AND target:Post AND target.id IN $post_ids)) "
                "RETURN labels(source)[0] AS source_label, properties(source) AS source, "
                "labels(target)[0] AS target_label, properties(target) AS target, "
                "type(relation) AS relation, properties(relation) AS relation_props "
                "LIMIT 1000",
                post_ids=post_ids,
            )
            for record in related_records:
                source = record["source"]
                target = record["target"]
                add_node(record["source_label"], source)
                add_node(record["target_label"], target)
                add_edge(
                    source.get("id"),
                    target.get("id"),
                    record["relation"],
                    record["relation_props"],
                )

        user_ids = [node_id for node_id, node in nodes.items() if node["label"] == "User"]
        if user_ids:
            user_relationships = session.run(
                "MATCH (source:User)-[relation]->(target) "
                "WHERE (type(relation) = 'POSTED_FROM' AND target:IPAddress "
                "AND source.id IN $user_ids) "
                "OR (type(relation) = 'FOLLOWS' AND target:User "
                "AND source.id IN $user_ids AND target.id IN $user_ids) "
                "RETURN properties(source) AS source, labels(target)[0] AS target_label, "
                "properties(target) AS target, type(relation) AS relation, "
                "properties(relation) AS relation_props LIMIT 2000",
                user_ids=user_ids,
            )
            for record in user_relationships:
                source = record["source"]
                target = record["target"]
                add_node("User", source)
                add_node(record["target_label"], target)
                add_edge(
                    source.get("id"),
                    target.get("id"),
                    record["relation"],
                    record["relation_props"],
                )

    return {"nodes": list(nodes.values()), "edges": list(edges.values())}