"""In-memory graph store for database-free development (``NEO4J_URI`` unset).

Loads the same deterministic dataset the Neo4j seed script writes
(app/data/synthetic.py) and implements the same analytics semantics as the Cypher
queries, so memory mode and Aura answer the same questions identically.
"""
from copy import deepcopy
from datetime import datetime, timezone
from itertools import combinations
from threading import RLock
from typing import Any
from uuid import uuid4

from app.analytics import (
    HIGH_SEVERITY,
    SEVERITY_BUCKETS,
    WINDOW_SECONDS,
    aggregate_clusters,
    previous_period,
    severity_bucket_label,
    trend,
)
from app.data.synthetic import demo_burst, generate_dataset
from app.schemas.filters import GraphFilters


class DuplicateEntityError(ValueError):
    pass


class MissingEntityError(ValueError):
    pass


class MemoryGraphStore:
    def __init__(self):
        self._lock = RLock()
        self._nodes: dict[str, dict[str, dict[str, Any]]] = {
            "User": {},
            "Post": {},
            "Hashtag": {},
            "IPAddress": {},
        }
        self._edges: list[dict[str, Any]] = []
        self._edge_keys: set[tuple[str, str, str]] = set()
        self._load_demo_data()

    def _load_demo_data(self) -> None:
        dataset = generate_dataset()
        for label, items in dataset["nodes"].items():
            self._nodes[label].update(items)
        self._edges.extend(dataset["edges"])
        self._rebuild_edge_keys()

    def _rebuild_edge_keys(self) -> None:
        self._edge_keys = {(edge["source"], edge["target"], edge["type"]) for edge in self._edges}

    def _add_edge(
        self,
        source: str,
        target: str,
        relation: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        key = (source, target, relation)
        if key in self._edge_keys:
            return
        self._edge_keys.add(key)
        self._edges.append(
            {
                "source": source,
                "target": target,
                "type": relation,
                "properties": deepcopy(properties or {}),
            }
        )

    @staticmethod
    def _datetime(value: Any) -> datetime:
        if isinstance(value, datetime):
            result = value
        else:
            result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if result.tzinfo is None:
            return result.replace(tzinfo=timezone.utc)
        return result

    def _matches_post(self, post: dict[str, Any], filters: GraphFilters) -> bool:
        params = filters.cypher_params()
        timestamp = self._datetime(post["timestamp"])
        if params["from_date"] and timestamp < params["from_date"]:
            return False
        if params["to_date"] and timestamp > params["to_date"]:
            return False
        if params["platform"] and post.get("platform") != params["platform"]:
            return False
        return float(post.get("severity", 0)) >= filters.min_severity

    # ------------------------------------------------------------------ CRUD
    def list_entities(
        self,
        label: str,
        params: dict[str, Any] | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> dict[str, Any]:
        params = params or {}
        with self._lock:
            nodes = list(self._nodes[label].values())
            if label == "User":
                nodes = [
                    node
                    for node in nodes
                    if (params.get("platform") is None or node.get("platform") == params["platform"])
                    and (params.get("flagged") is None or node.get("flagged") == params["flagged"])
                ]
            elif label == "Post":
                start = params.get("from")
                end = params.get("to")
                severity = params.get("min_severity")
                nodes = [
                    node
                    for node in nodes
                    if (start is None or self._datetime(node["timestamp"]) >= self._datetime(start))
                    and (end is None or self._datetime(node["timestamp"]) <= self._datetime(end))
                    and (params.get("platform") is None or node.get("platform") == params["platform"])
                    and (severity is None or node.get("severity", 0) >= severity)
                ]
            nodes.sort(key=lambda node: node["id"])
            return {
                "items": deepcopy(nodes[offset : offset + limit]),
                "total": len(nodes),
                "offset": offset,
                "limit": limit,
            }

    def get_entity(self, label: str, entity_id: str) -> dict[str, Any] | None:
        with self._lock:
            node = self._nodes[label].get(entity_id)
            return deepcopy(node) if node else None

    def count_entities(self) -> dict[str, int]:
        with self._lock:
            return {label: len(items) for label, items in self._nodes.items()}

    def _create_entity(self, label: str, properties: dict[str, Any]) -> dict[str, Any]:
        entity_id = properties["id"]
        if entity_id in self._nodes[label]:
            raise DuplicateEntityError(f"{label} already exists")
        if label == "Hashtag" and any(
            node.get("tag") == properties.get("tag")
            for node in self._nodes["Hashtag"].values()
        ):
            raise DuplicateEntityError("Hashtag already exists")
        self._nodes[label][entity_id] = deepcopy(properties)
        return deepcopy(self._nodes[label][entity_id])

    def create_entity(self, label: str, properties: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            return self._create_entity(label, properties)

    def create_user(self, properties: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            ip_id = properties.get("ip_hash")
            if ip_id and ip_id not in self._nodes["IPAddress"]:
                raise MissingEntityError("IPAddress not found")
            user = self._create_entity("User", properties)
            if ip_id:
                self._add_edge(
                    user["id"],
                    ip_id,
                    "POSTED_FROM",
                    {"timestamp": user.get("created_at")},
                )
            return user

    def create_post(
        self,
        properties: dict[str, Any],
        author_id: str | None,
        hashtags: list[str],
    ) -> dict[str, Any]:
        with self._lock:
            if author_id and author_id not in self._nodes["User"]:
                raise MissingEntityError("User not found")
            post = self._create_entity("Post", properties)
            if author_id:
                self._add_edge(
                    author_id,
                    post["id"],
                    "POSTED",
                    {"timestamp": post.get("timestamp")},
                )
            for tag in dict.fromkeys(hashtags):
                hashtag = next(
                    (node for node in self._nodes["Hashtag"].values() if node["tag"] == tag),
                    None,
                )
                if hashtag is None:
                    hashtag = self._create_entity(
                        "Hashtag", {"id": str(uuid4()), "tag": tag}
                    )
                self._add_edge(post["id"], hashtag["id"], "MENTIONS")
            return post

    def update_entity(
        self, label: str, entity_id: str, properties: dict[str, Any]
    ) -> dict[str, Any] | None:
        with self._lock:
            node = self._nodes[label].get(entity_id)
            if not node:
                return None
            if label == "Hashtag" and "tag" in properties and any(
                other_id != entity_id and other.get("tag") == properties["tag"]
                for other_id, other in self._nodes["Hashtag"].items()
            ):
                raise DuplicateEntityError("Hashtag already exists")
            if label == "User" and "ip_hash" in properties:
                ip_id = properties["ip_hash"]
                if ip_id and ip_id not in self._nodes["IPAddress"]:
                    raise MissingEntityError("IPAddress not found")
                self._edges = [
                    edge
                    for edge in self._edges
                    if not (edge["source"] == entity_id and edge["type"] == "POSTED_FROM")
                ]
                self._rebuild_edge_keys()
                if ip_id is None:
                    node.pop("ip_hash", None)
                else:
                    node["ip_hash"] = ip_id
                    self._add_edge(
                        entity_id,
                        ip_id,
                        "POSTED_FROM",
                        {"timestamp": node.get("created_at")},
                    )
                properties = {key: value for key, value in properties.items() if key != "ip_hash"}
            node.update(deepcopy(properties))
            return deepcopy(node)

    def delete_entity(self, label: str, entity_id: str) -> bool:
        with self._lock:
            if entity_id not in self._nodes[label]:
                return False
            del self._nodes[label][entity_id]
            self._edges = [
                edge
                for edge in self._edges
                if edge["source"] != entity_id and edge["target"] != entity_id
            ]
            self._rebuild_edge_keys()
            return True

    def create_demo_burst(self, platform: str) -> dict[str, Any]:
        """Inject a live coordinated burst (POST /demo/coordination) using the shared builder."""
        burst = demo_burst(platform)
        with self._lock:
            self._create_entity("IPAddress", burst["ip"])
            self._create_entity("Hashtag", burst["hashtag"])
            for user in burst["users"]:
                self._create_entity("User", user)
            for post in burst["posts"]:
                self._create_entity("Post", post)
            for edge in burst["edges"]:
                self._add_edge(edge["source"], edge["target"], edge["type"], edge["properties"])
        return burst["result"]

    # ------------------------------------------------------------------ analytics
    def coordination_clusters(self, filters: GraphFilters) -> list[dict[str, Any]]:
        """Same pair semantics as ``CLUSTER_PAIR_QUERY`` in app/analytics.py."""
        with self._lock:
            users = deepcopy(self._nodes["User"])
            posts = deepcopy(self._nodes["Post"])
            hashtags = deepcopy(self._nodes["Hashtag"])
            ips = deepcopy(self._nodes["IPAddress"])
            edges = deepcopy(self._edges)

        users_by_ip: dict[str, set[str]] = {}
        posts_by_user: dict[str, set[str]] = {}
        tags_by_post: dict[str, set[str]] = {}
        for edge in edges:
            if edge["type"] == "POSTED_FROM":
                users_by_ip.setdefault(edge["target"], set()).add(edge["source"])
            elif edge["type"] == "POSTED":
                posts_by_user.setdefault(edge["source"], set()).add(edge["target"])
            elif edge["type"] == "MENTIONS":
                tags_by_post.setdefault(edge["source"], set()).add(edge["target"])

        def matching_posts(user_id: str) -> list[tuple[str, dict[str, Any]]]:
            return [
                (post_id, posts[post_id])
                for post_id in posts_by_user.get(user_id, set())
                if post_id in posts and self._matches_post(posts[post_id], filters)
            ]

        records = []
        for ip_id, user_ids in users_by_ip.items():
            if len(user_ids) < 2:
                continue
            ip = ips.get(ip_id, {})
            for user1_id, user2_id in combinations(sorted(user_ids), 2):
                user1, user2 = users.get(user1_id, {}), users.get(user2_id, {})
                for post1_id, post1 in matching_posts(user1_id):
                    for post2_id, post2 in matching_posts(user2_id):
                        if post1_id == post2_id:
                            continue
                        delta = abs(
                            (self._datetime(post1["timestamp"]) - self._datetime(post2["timestamp"])).total_seconds()
                        )
                        if delta > WINDOW_SECONDS:
                            continue
                        for hashtag_id in tags_by_post.get(post1_id, set()) & tags_by_post.get(post2_id, set()):
                            if hashtag_id not in hashtags:
                                continue
                            records.append({
                                "ip_id": ip_id,
                                "cluster_ip": ip.get("address", ip_id),
                                "network_type": ip.get("network_type"),
                                "hashtag": hashtags[hashtag_id]["tag"],
                                "u1_id": user1_id, "u1_handle": user1.get("handle"), "u1_flagged": user1.get("flagged"),
                                "u2_id": user2_id, "u2_handle": user2.get("handle"), "u2_flagged": user2.get("flagged"),
                                "p1_id": post1_id, "p1_timestamp": post1["timestamp"],
                                "p1_severity": post1.get("severity"), "p1_text": post1.get("text"),
                                "p1_platform": post1.get("platform"),
                                "p2_id": post2_id, "p2_timestamp": post2["timestamp"],
                                "p2_severity": post2.get("severity"), "p2_text": post2.get("text"),
                                "p2_platform": post2.get("platform"),
                            })
        return aggregate_clusters(records, filters)

    def graph(self, filters: GraphFilters) -> dict[str, list[dict[str, Any]]]:
        with self._lock:
            nodes_by_label = deepcopy(self._nodes)
            edges = deepcopy(self._edges)

        posts = [
            post for post in nodes_by_label["Post"].values() if self._matches_post(post, filters)
        ]
        posts.sort(key=lambda post: self._datetime(post["timestamp"]), reverse=True)
        if filters.min_density > 1:
            eligible_ids = {
                post_id
                for cluster in self.coordination_clusters(filters)
                for post_id in cluster["post_ids"]
            }
            posts = [post for post in posts if post["id"] in eligible_ids]
        posts = posts[:120]
        selected_post_ids = {post["id"] for post in posts}
        label_of = {
            entity_id: label for label, items in nodes_by_label.items() for entity_id in items
        }
        graph_nodes: dict[str, dict[str, Any]] = {}
        graph_edges: dict[tuple[str, str, str], dict[str, Any]] = {}

        def add_node(entity_id: str) -> None:
            label = label_of.get(entity_id)
            if label:
                graph_nodes[entity_id] = {
                    "id": entity_id,
                    "label": label,
                    "props": deepcopy(nodes_by_label[label][entity_id]),
                }

        def add_edge(edge: dict[str, Any]) -> None:
            graph_edges[(edge["source"], edge["target"], edge["type"])] = {
                "source": edge["source"],
                "target": edge["target"],
                "type": edge["type"],
                **(
                    {"timestamp": deepcopy(edge["properties"]["timestamp"])}
                    if edge["properties"].get("timestamp") is not None
                    else {}
                ),
            }

        for post in posts:
            add_node(post["id"])
        for edge in edges:
            if edge["type"] == "REPLIED_TO" and not (
                edge["source"] in selected_post_ids and edge["target"] in selected_post_ids
            ):
                continue
            if edge["source"] in selected_post_ids or edge["target"] in selected_post_ids:
                add_node(edge["source"])
                add_node(edge["target"])
                add_edge(edge)

        selected_users = {
            node_id for node_id, node in graph_nodes.items() if node["label"] == "User"
        }
        for edge in edges:
            if edge["type"] == "POSTED_FROM" and edge["source"] in selected_users:
                add_node(edge["target"])
                add_edge(edge)
            elif (
                edge["type"] == "FOLLOWS"
                and edge["source"] in selected_users
                and edge["target"] in selected_users
            ):
                add_edge(edge)

        return {"nodes": list(graph_nodes.values()), "edges": list(graph_edges.values())}

    def _summary_core(self, filters: GraphFilters) -> dict[str, Any]:
        with self._lock:
            nodes = deepcopy(self._nodes)
            edges = deepcopy(self._edges)
        clusters = self.coordination_clusters(filters)
        posts = [post for post in nodes["Post"].values() if self._matches_post(post, filters)]
        if filters.min_density > 1:
            eligible = {post_id for cluster in clusters for post_id in cluster["post_ids"]}
            posts = [post for post in posts if post["id"] in eligible]
        post_ids = {post["id"] for post in posts}

        authors: set[str] = set()
        flagged: set[str] = set()
        hashtag_posts: dict[str, set[str]] = {}
        for edge in edges:
            if edge["type"] in {"POSTED", "RETWEETED"} and edge["target"] in post_ids:
                if edge["type"] == "POSTED":
                    authors.add(edge["source"])
                if nodes["User"].get(edge["source"], {}).get("flagged") is True:
                    flagged.add(edge["source"])
            elif edge["type"] == "MENTIONS" and edge["source"] in post_ids:
                tag = nodes["Hashtag"].get(edge["target"], {}).get("tag")
                if tag:
                    hashtag_posts.setdefault(tag, set()).add(edge["source"])

        by_day: dict[str, dict[str, int]] = {}
        platforms: dict[str, int] = {}
        buckets = [0] * len(SEVERITY_BUCKETS)
        severities: list[float] = []
        for post in posts:
            severity = float(post.get("severity", 0))
            severities.append(severity)
            day = by_day.setdefault(
                self._datetime(post["timestamp"]).date().isoformat(), {"count": 0, "high_severity": 0}
            )
            day["count"] += 1
            day["high_severity"] += int(severity >= HIGH_SEVERITY)
            platform = post.get("platform") or "Unknown"
            platforms[platform] = platforms.get(platform, 0) + 1
            for index, (low, high) in enumerate(SEVERITY_BUCKETS):
                if low <= severity < high:
                    buckets[index] += 1
                    break

        return {
            "total_posts": len(posts),
            "total_accounts": len(authors),
            "total_flagged_users": len(flagged),
            "coordinated_clusters": len(clusters),
            "high_severity_posts": sum(severity >= HIGH_SEVERITY for severity in severities),
            "avg_severity": round(sum(severities) / len(severities), 3) if severities else 0,
            "posts_over_time": [
                {"bucket": bucket, **counts} for bucket, counts in sorted(by_day.items())
            ],
            "top_hashtags": [
                {"tag": tag, "count": len(ids)}
                for tag, ids in sorted(hashtag_posts.items(), key=lambda item: (-len(item[1]), item[0]))[:10]
            ],
            "platform_breakdown": [
                {"platform": platform, "count": count}
                for platform, count in sorted(platforms.items(), key=lambda item: (-item[1], item[0]))
            ],
            "severity_distribution": [
                {"range": severity_bucket_label(low, high), "count": buckets[index]}
                for index, (low, high) in enumerate(SEVERITY_BUCKETS)
            ],
        }

    def summary(self, filters: GraphFilters) -> dict[str, Any]:
        summary = self._summary_core(filters)
        previous_filters = previous_period(filters)
        previous = self._summary_core(previous_filters) if previous_filters else None
        summary["trends"] = (
            {key: trend(summary[key], previous[key]) for key in TREND_KEYS} if previous else None
        )
        summary["density_scoped"] = filters.min_density > 1
        return summary


TREND_KEYS = ("total_posts", "total_flagged_users", "coordinated_clusters", "high_severity_posts", "avg_severity")

memory_store = MemoryGraphStore()
