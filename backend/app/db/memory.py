from copy import deepcopy
from datetime import datetime, timedelta, timezone
from itertools import combinations
import random
from threading import RLock
from typing import Any
from uuid import uuid4

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
        self._load_demo_data()

    def _load_demo_data(self) -> None:
        now = datetime.now(timezone.utc)
        rng = random.Random(554)
        self._nodes["IPAddress"].update(
            {
                "ip_101": {
                    "id": "ip_101",
                    "address": "198.51.100.14",
                    "geo_region": "US-East",
                },
                "ip_200": {
                    "id": "ip_200",
                    "address": "192.0.2.100",
                    "geo_region": "UNKNOWN-PROXY",
                },
            }
        )
        self._nodes["Hashtag"].update(
            {
                "h_001": {"id": "h_001", "tag": "#DisinfoCampaign"},
                "h_002": {"id": "h_002", "tag": "#BotnetDetected"},
            }
        )
        user_data = [
            ("u_001", "@alpha_intel", "ip_101", False, 15400),
            ("u_004", "@shadow_bot01", "ip_200", True, 12),
            ("u_005", "@shadow_bot02", "ip_200", True, 5),
            ("u_006", "@shadow_bot03", "ip_200", True, 8),
        ]
        for user_id, handle, ip_id, flagged, followers in user_data:
            self._nodes["User"][user_id] = {
                "id": user_id,
                "handle": handle,
                "platform": "X",
                "created_at": now - timedelta(days=90),
                "follower_count": followers,
                "ip_hash": ip_id,
                "flagged": flagged,
            }
            self._add_edge(
                user_id,
                ip_id,
                "POSTED_FROM",
                {"timestamp": now - timedelta(days=1)},
            )

        posts = [
            ("p_001", "u_001", now - timedelta(days=2), 0.85, "Spike in network activity detected.", ["#DisinfoCampaign"]),
            ("p_002", "u_004", now - timedelta(minutes=12), 0.92, "Urgent: system breakdown imminent. Repost before it is censored!", ["#BotnetDetected", "#DisinfoCampaign"]),
            ("p_003", "u_005", now - timedelta(minutes=7), 0.92, "Urgent: system breakdown imminent. Repost before it is censored!", ["#BotnetDetected", "#DisinfoCampaign"]),
            ("p_004", "u_006", now - timedelta(minutes=2), 0.92, "Urgent: system breakdown imminent. Repost before it is censored!", ["#BotnetDetected", "#DisinfoCampaign"]),
        ]
        hashtag_ids = {node["tag"]: node_id for node_id, node in self._nodes["Hashtag"].items()}
        for post_id, author_id, timestamp, severity, text, tags in posts:
            self._nodes["Post"][post_id] = {
                "id": post_id,
                "text": text,
                "timestamp": timestamp,
                "platform": "X",
                "severity": severity,
                "language": "en",
            }
            self._add_edge(author_id, post_id, "POSTED", {"timestamp": timestamp})
            for tag in tags:
                self._add_edge(post_id, hashtag_ids[tag], "MENTIONS", {})

        platforms = ["X", "Telegram", "Facebook"]
        for index in range(3, 11):
            hashtag_id = f"h_{index:03d}"
            tag = [
                "#DeepFakeAlert",
                "#OSINTInvestigates",
                "#CyberSecurity",
                "#SignalWatch",
                "#OpenSourceIntel",
                "#NarrativeShift",
                "#CivicMonitor",
                "#NetworkBrief",
            ][index - 3]
            self._nodes["Hashtag"][hashtag_id] = {"id": hashtag_id, "tag": tag}
            hashtag_ids[tag] = hashtag_id

        generated_users = []
        cluster_members: dict[int, list[str]] = {index: [] for index in range(5)}
        for index in range(5, 201):
            user_id = f"u_seed_{index:03d}"
            cluster_index = (index - 5) // 8 if index < 45 else None
            platform = platforms[(cluster_index if cluster_index is not None else index) % len(platforms)]
            if cluster_index is not None:
                ip_id = f"ip_cluster_{cluster_index + 1:02d}"
                cluster_members[cluster_index].append(user_id)
            else:
                ip_id = f"ip_{index:03d}"
            if ip_id not in self._nodes["IPAddress"]:
                ip_octet = (index % 250) + 1
                address_prefix = ("192.0.2", "198.51.100", "203.0.113")[index % 3]
                self._nodes["IPAddress"][ip_id] = {
                    "id": ip_id,
                    "address": f"{address_prefix}.{ip_octet}",
                    "geo_region": ("US-East", "EU-West", "APAC-West")[index % 3],
                }
            handle = f"@signal_{index:03d}"
            flagged = cluster_index is not None or rng.random() < 0.08
            self._nodes["User"][user_id] = {
                "id": user_id,
                "handle": handle,
                "platform": platform,
                "created_at": now - timedelta(days=rng.randint(30, 900)),
                "follower_count": rng.randint(2, 250000),
                "ip_hash": ip_id,
                "flagged": flagged,
            }
            self._add_edge(
                user_id,
                ip_id,
                "POSTED_FROM",
                {"timestamp": now - timedelta(days=rng.randint(1, 30))},
            )
            generated_users.append(user_id)

        regular_post_count = 2000 - len(posts) - sum(map(len, cluster_members.values()))
        for index in range(regular_post_count):
            author_id = rng.choice(generated_users)
            user = self._nodes["User"][author_id]
            timestamp = now - timedelta(minutes=rng.randint(0, 30 * 24 * 60))
            post_id = f"p_{index + len(posts) + 1:05d}"
            severity = round(rng.random(), 3)
            text = rng.choice(
                (
                    "New footage is circulating; source verification is still in progress.",
                    "Local observers report a sudden change in the public conversation.",
                    "A rapid repost pattern is visible across several accounts.",
                    "Archived material is being recirculated with a new caption.",
                    "Several channels are repeating the same unverified claim.",
                    "Open-source review found conflicting dates in the shared image.",
                    "A coordinated set of posts appeared shortly after the first report.",
                    "The original source remains unclear; preserve the current evidence.",
                    "Analysts are comparing account activity and narrative overlap.",
                    "A translated excerpt is spreading beyond its original context.",
                )
            )
            selected_tags = rng.sample(list(hashtag_ids), rng.randint(1, 2))
            self._nodes["Post"][post_id] = {
                "id": post_id,
                "text": text,
                "timestamp": timestamp,
                "platform": user["platform"],
                "severity": severity,
                "language": "en",
            }
            self._add_edge(author_id, post_id, "POSTED", {"timestamp": timestamp})
            for tag in selected_tags:
                self._add_edge(post_id, hashtag_ids[tag], "MENTIONS", {})

            if index % 11 == 0:
                retweeter_id = rng.choice(generated_users)
                if retweeter_id != author_id:
                    self._add_edge(
                        retweeter_id,
                        post_id,
                        "RETWEETED",
                        {"timestamp": timestamp + timedelta(minutes=rng.randint(1, 20))},
                    )
            if index > 0 and index % 17 == 0:
                replied_to = f"p_{rng.randint(len(posts) + 1, index + len(posts)):05d}"
                if replied_to in self._nodes["Post"]:
                    self._add_edge(post_id, replied_to, "REPLIED_TO", {"timestamp": timestamp})
            if index % 29 == 0:
                mentioned_user = rng.choice(generated_users)
                if mentioned_user != author_id:
                    self._add_edge(post_id, mentioned_user, "TAGGED_USER", {})

        for user_id in generated_users:
            for followed_id in rng.sample(generated_users, 4):
                if followed_id != user_id:
                    self._add_edge(user_id, followed_id, "FOLLOWS", {})

        for cluster_index, members in cluster_members.items():
            common_tag = f"#Coordination{cluster_index + 1}"
            hashtag_id = f"h_coord_{cluster_index + 1:02d}"
            if common_tag not in hashtag_ids:
                self._nodes["Hashtag"][hashtag_id] = {"id": hashtag_id, "tag": common_tag}
                hashtag_ids[common_tag] = hashtag_id
            burst_start = now - timedelta(hours=cluster_index + 1, minutes=20)
            for member_index, user_id in enumerate(members):
                post_id = f"p_coord_{cluster_index + 1:02d}_{member_index + 1:02d}"
                timestamp = burst_start + timedelta(minutes=member_index * 2)
                self._nodes["Post"][post_id] = {
                    "id": post_id,
                    "text": f"Coordinated narrative {cluster_index + 1}: verify the latest update now.",
                    "timestamp": timestamp,
                    "platform": self._nodes["User"][user_id]["platform"],
                    "severity": 0.85 + (member_index % 3) * 0.05,
                    "language": "en",
                }
                self._add_edge(user_id, post_id, "POSTED", {"timestamp": timestamp})
                self._add_edge(post_id, hashtag_id, "MENTIONS", {})

            for member_index in range(1, len(members)):
                self._add_edge(members[member_index], f"p_coord_{cluster_index + 1:02d}_01", "RETWEETED", {"timestamp": burst_start + timedelta(minutes=member_index * 2 + 1)})

    def _add_edge(
        self,
        source: str,
        target: str,
        relation: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        if not any(
            edge["source"] == source
            and edge["target"] == target
            and edge["type"] == relation
            for edge in self._edges
        ):
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
            return True

    def coordination_clusters(self, filters: GraphFilters) -> list[dict[str, Any]]:
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

        groups: dict[tuple[str, str], dict[str, Any]] = {}
        for ip_id, user_ids in users_by_ip.items():
            for user1_id, user2_id in combinations(sorted(user_ids), 2):
                for post1_id in posts_by_user.get(user1_id, set()):
                    post1 = posts.get(post1_id)
                    if not post1 or not self._matches_post(post1, filters):
                        continue
                    for post2_id in posts_by_user.get(user2_id, set()):
                        post2 = posts.get(post2_id)
                        if not post2 or post1_id == post2_id or not self._matches_post(post2, filters):
                            continue
                        time1 = self._datetime(post1["timestamp"])
                        time2 = self._datetime(post2["timestamp"])
                        if abs((time1 - time2).total_seconds()) > 3600:
                            continue
                        for hashtag_id in tags_by_post.get(post1_id, set()) & tags_by_post.get(post2_id, set()):
                            hashtag = hashtags.get(hashtag_id)
                            if not hashtag:
                                continue
                            key = (ip_id, hashtag_id)
                            group = groups.setdefault(
                                key,
                                {
                                    "id": f"{ip_id}:{hashtag['tag']}",
                                    "cluster_ip": ips.get(ip_id, {}).get("address", ip_id),
                                    "hashtag": hashtag["tag"],
                                    "_user_ids": set(),
                                    "_post_times": {},
                                    "_severities": {},
                                },
                            )
                            group["_user_ids"].update((user1_id, user2_id))
                            for post_id, post in ((post1_id, post1), (post2_id, post2)):
                                group["_post_times"][post_id] = self._datetime(post["timestamp"])
                                group["_severities"][post_id] = float(post.get("severity", 0))

        clusters = []
        for group in groups.values():
            user_ids = sorted(group.pop("_user_ids"))
            if len(user_ids) < filters.min_density:
                continue
            post_times = group.pop("_post_times")
            severities = group.pop("_severities")
            handles = sorted(users[user_id]["handle"] for user_id in user_ids if users[user_id].get("handle"))
            avg_severity = sum(severities.values()) / max(len(severities), 1)
            window = (max(post_times.values()) - min(post_times.values())).total_seconds() / 60
            group.update(
                {
                    "user_ids": user_ids,
                    "user_handles": handles,
                    "post_ids": sorted(post_times),
                    "time_window_minutes": round(window, 1),
                    "risk_score": round(
                        min(1.0, 0.25 + min(len(user_ids), 5) * 0.1 + avg_severity * 0.25),
                        3,
                    ),
                }
            )
            clusters.append(group)
        return sorted(clusters, key=lambda cluster: cluster["risk_score"], reverse=True)

    def graph(self, filters: GraphFilters) -> dict[str, list[dict[str, Any]]]:
        with self._lock:
            nodes_by_label = deepcopy(self._nodes)
            edges = deepcopy(self._edges)

        posts = [
            post for post in nodes_by_label["Post"].values() if self._matches_post(post, filters)
        ]
        posts.sort(key=lambda post: post["timestamp"], reverse=True)
        if filters.min_density > 1:
            eligible_ids = {
                post_id
                for cluster in self.coordination_clusters(filters)
                for post_id in cluster["post_ids"]
            }
            posts = [post for post in posts if post["id"] in eligible_ids]
        posts = posts[:120]
        selected_post_ids = {post["id"] for post in posts}
        graph_nodes: dict[str, dict[str, Any]] = {}
        graph_edges: dict[tuple[str, str, str], dict[str, Any]] = {}

        def add_node(label: str, entity_id: str) -> None:
            node = nodes_by_label[label].get(entity_id)
            if node:
                graph_nodes[entity_id] = {
                    "id": entity_id,
                    "label": label,
                    "props": deepcopy(node),
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
            add_node("Post", post["id"])
        for edge in edges:
            if edge["type"] == "REPLIED_TO" and not (
                edge["source"] in selected_post_ids and edge["target"] in selected_post_ids
            ):
                continue
            direct_to_post = edge["source"] in selected_post_ids or edge["target"] in selected_post_ids
            if direct_to_post:
                for label, entity_id in nodes_by_label.items():
                    if edge["source"] in entity_id:
                        add_node(label, edge["source"])
                    if edge["target"] in entity_id:
                        add_node(label, edge["target"])
                add_edge(edge)

        selected_users = {
            node_id for node_id, node in graph_nodes.items() if node["label"] == "User"
        }
        for edge in edges:
            if edge["type"] == "POSTED_FROM" and edge["source"] in selected_users:
                add_node("IPAddress", edge["target"])
                add_edge(edge)
            elif (
                edge["type"] == "FOLLOWS"
                and edge["source"] in selected_users
                and edge["target"] in selected_users
            ):
                add_edge(edge)

        return {"nodes": list(graph_nodes.values()), "edges": list(graph_edges.values())}

    def summary(self, filters: GraphFilters) -> dict[str, Any]:
        with self._lock:
            nodes = deepcopy(self._nodes)
            edges = deepcopy(self._edges)
        posts = [
            post for post in nodes["Post"].values() if self._matches_post(post, filters)
        ]
        post_ids = {post["id"] for post in posts}
        flagged_ids = {
            edge["source"]
            for edge in edges
            if edge["type"] in {"POSTED", "RETWEETED"}
            and edge["target"] in post_ids
            and nodes["User"].get(edge["source"], {}).get("flagged") is True
        }
        by_day: dict[str, int] = {}
        hashtag_counts: dict[str, set[str]] = {}
        for post in posts:
            bucket = self._datetime(post["timestamp"]).date().isoformat()
            by_day[bucket] = by_day.get(bucket, 0) + 1
        for edge in edges:
            if edge["type"] == "MENTIONS" and edge["source"] in post_ids:
                hashtag = nodes["Hashtag"].get(edge["target"])
                if hashtag:
                    hashtag_counts.setdefault(hashtag["tag"], set()).add(edge["source"])
        severities = [float(post.get("severity", 0)) for post in posts]
        clusters = self.coordination_clusters(filters)
        return {
            "total_posts": len(posts),
            "total_flagged_users": len(flagged_ids),
            "coordinated_clusters": len(clusters),
            "avg_severity": round(sum(severities) / len(severities), 3) if severities else 0,
            "posts_over_time": [
                {"bucket": bucket, "count": count} for bucket, count in sorted(by_day.items())
            ],
            "top_hashtags": [
                {"tag": tag, "count": len(post_ids)}
                for tag, post_ids in sorted(
                    hashtag_counts.items(), key=lambda item: (-len(item[1]), item[0])
                )[:10]
            ],
        }


memory_store = MemoryGraphStore()