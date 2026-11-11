"""GraphRAG retrieval: bounded sub-graph extraction + deterministic detector findings.

Pipeline (docs/06_GRAPHRAG.md §2):
1. The route loads the *same* filtered graph the dashboard renders and the cluster rows.
2. :func:`build_context` ranks nodes (analyst focus > detected clusters > severity / flags)
   and greedily keeps whole posts *with* their authors, hashtags and infrastructure, so
   the model sees connected evidence instead of an arbitrary slice of nodes.
3. Deterministic findings (clusters, near-duplicate text, amplification, new low-follower
   accounts, shared infrastructure) are computed in Python and given to the model as
   labelled facts — the model explains and weighs evidence, it does not have to detect it.
4. :func:`serialize_context` renders a compact, line-oriented text the model can cite by ID.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.analytics import _jaccard, _text_signature, native_datetime

MAX_CONTEXT_NODES = 120
MAX_CONTEXT_EDGES = 260
MAX_CLUSTERS = 8
MAX_TEXT_CHARS = 220
NEW_ACCOUNT_DAYS = 60

AUTHORSHIP = {"POSTED", "RETWEETED"}


@dataclass
class InvestigationContext:
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    findings: list[dict[str, Any]]
    clusters: list[dict[str, Any]]
    nodes_in_filter: int
    truncated: bool
    focus_node_ids: list[str] = field(default_factory=list)

    @property
    def citable_ids(self) -> set[str]:
        ids = {str(node["id"]) for node in self.nodes}
        for finding in self.findings:
            ids.update(finding.get("node_ids", []))
        return ids


def _parse_time(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        return native_datetime(value)
    except (TypeError, ValueError):
        return None


def build_context(
    graph: dict[str, Any],
    clusters: list[dict[str, Any]],
    focus_node_ids: list[str] | None = None,
    now: datetime | None = None,
) -> InvestigationContext:
    now = now or datetime.now(timezone.utc)
    nodes = {str(node["id"]): node for node in graph.get("nodes", [])}
    edges = [edge for edge in graph.get("edges", []) if str(edge["source"]) in nodes and str(edge["target"]) in nodes]
    focus = [node_id for node_id in dict.fromkeys(focus_node_ids or []) if node_id in nodes]

    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        adjacency[str(edge["source"])].add(str(edge["target"]))
        adjacency[str(edge["target"])].add(str(edge["source"]))

    # ------------------------------------------------------------- scoring
    score: dict[str, float] = defaultdict(float)
    for node_id, node in nodes.items():
        props = node.get("props", {})
        score[node_id] += min(len(adjacency[node_id]), 12) * 0.5
        if node["label"] == "Post":
            score[node_id] += float(props.get("severity") or 0) * 20
        if props.get("flagged"):
            score[node_id] += 15
    top_clusters = clusters[:MAX_CLUSTERS]
    for rank, cluster in enumerate(top_clusters):
        bonus = max(30 - rank * 3, 8) * float(cluster.get("risk_score") or 0.5)
        for node_id in [*cluster.get("user_ids", []), *cluster.get("post_ids", []), cluster.get("ip_id")]:
            if node_id in nodes:
                score[node_id] += bonus
    for node_id in focus:
        score[node_id] += 120
        for neighbor in adjacency[node_id]:
            score[neighbor] += 45

    # ------------------------------------------------------------- greedy, connected selection
    selected: dict[str, None] = {}

    def bundle(node_id: str) -> list[str]:
        """A node plus the context needed to interpret it."""
        label = nodes[node_id]["label"]
        result = [node_id]
        if label == "Post":
            neighbors = sorted(adjacency[node_id], key=lambda n: -score[n])
            result += [n for n in neighbors if nodes[n]["label"] in {"User", "Hashtag"}][:8]
            result += [
                ip for user in result if nodes[user]["label"] == "User"
                for ip in adjacency[user] if nodes[ip]["label"] == "IPAddress"
            ]
        elif label == "User":
            result += [n for n in adjacency[node_id] if nodes[n]["label"] == "IPAddress"]
            posts = sorted((n for n in adjacency[node_id] if nodes[n]["label"] == "Post"), key=lambda n: -score[n])
            result += posts[:2]
        else:  # Hashtag / IPAddress: show who is behind it
            result += sorted(adjacency[node_id], key=lambda n: -score[n])[:6]
        return list(dict.fromkeys(result))

    seeds = focus + sorted((n for n in nodes if nodes[n]["label"] == "Post"), key=lambda n: -score[n])
    for seed in seeds:
        if len(selected) >= MAX_CONTEXT_NODES:
            break
        new = [n for n in bundle(seed) if n not in selected]
        if len(selected) + len(new) > MAX_CONTEXT_NODES:
            new = new[: MAX_CONTEXT_NODES - len(selected)]
        selected.update(dict.fromkeys(new))

    chosen_edges = [
        edge for edge in edges if str(edge["source"]) in selected and str(edge["target"]) in selected
    ]
    priority = {"POSTED": 0, "POSTED_FROM": 1, "RETWEETED": 2, "MENTIONS": 3, "REPLIED_TO": 4, "TAGGED_USER": 5, "FOLLOWS": 6}
    chosen_edges.sort(key=lambda edge: priority.get(edge["type"], 9))
    edge_truncated = len(chosen_edges) > MAX_CONTEXT_EDGES
    chosen_edges = chosen_edges[:MAX_CONTEXT_EDGES]

    chosen_nodes = [nodes[node_id] for node_id in selected]
    findings = detect_findings(chosen_nodes, chosen_edges, top_clusters, now)
    return InvestigationContext(
        nodes=chosen_nodes,
        edges=chosen_edges,
        findings=findings,
        clusters=top_clusters,
        nodes_in_filter=len(nodes),
        truncated=len(selected) < len(nodes) or edge_truncated,
        focus_node_ids=focus,
    )


def detect_findings(
    nodes: list[dict[str, Any]], edges: list[dict[str, Any]], clusters: list[dict[str, Any]], now: datetime
) -> list[dict[str, Any]]:
    by_id = {str(node["id"]): node for node in nodes}
    findings: list[dict[str, Any]] = []

    for index, cluster in enumerate(clusters, start=1):
        findings.append({
            "key": f"C{index}",
            "kind": "coordination_cluster",
            "text": (
                f"{len(cluster['user_ids'])} accounts on shared IP {cluster['ip_id']} ({cluster.get('cluster_ip')}, "
                f"network={cluster.get('network_type') or 'unknown'}) posted {cluster['hashtag']} "
                f"{len(cluster['post_ids'])} times within {cluster['time_window_minutes']} min "
                f"(first {cluster.get('first_seen', '?')[:16]}Z). flagged_accounts={cluster.get('flagged_users', 0)}. "
                f"risk_score={cluster['risk_score']} factors={cluster.get('risk_factors')}"
            ),
            "node_ids": [*cluster["user_ids"], *cluster["post_ids"], cluster["ip_id"]],
        })

    authors: dict[str, str] = {}
    retweeters: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        if edge["type"] == "POSTED":
            authors[str(edge["target"])] = str(edge["source"])
        elif edge["type"] == "RETWEETED":
            retweeters[str(edge["target"])].add(str(edge["source"]))

    # Near-duplicate text across distinct authors.
    posts = [node for node in nodes if node["label"] == "Post" and node["props"].get("text")]
    signatures = {str(post["id"]): _text_signature(post["props"]["text"]) for post in posts}
    assigned: set[str] = set()
    duplicate_index = 0
    for post in sorted(posts, key=lambda p: str(_parse_time(p["props"].get("timestamp")) or "")):
        post_id = str(post["id"])
        if post_id in assigned or not signatures[post_id]:
            continue
        group = [
            other_id for other_id, sig in signatures.items()
            if other_id not in assigned and _jaccard(signatures[post_id], sig) >= 0.6
        ]
        group_authors = {authors.get(pid) for pid in group if authors.get(pid)}
        if len(group) >= 3 and len(group_authors) >= 2:
            assigned.update(group)
            times = [t for t in (_parse_time(by_id[pid]["props"].get("timestamp")) for pid in group) if t]
            span = (max(times) - min(times)).total_seconds() / 60 if times else 0
            duplicate_index += 1
            findings.append({
                "key": f"D{duplicate_index}",
                "kind": "near_duplicate_text",
                "text": (
                    f"{len(group)} posts by {len(group_authors)} accounts share near-identical wording within "
                    f"{span:.0f} min: \"{_clip(post['props']['text'], 120)}\""
                ),
                "node_ids": sorted(group) + sorted(group_authors),
            })

    # Amplification.
    amplified = sorted(retweeters.items(), key=lambda item: -len(item[1]))[:4]
    for index, (post_id, users) in enumerate(amplified, start=1):
        if len(users) < 3:
            continue
        new_accounts = [u for u in users if _account_age_days(by_id.get(u), now) is not None and _account_age_days(by_id.get(u), now) < NEW_ACCOUNT_DAYS]
        flagged = [u for u in users if by_id.get(u, {}).get("props", {}).get("flagged")]
        findings.append({
            "key": f"A{index}",
            "kind": "amplification",
            "text": (
                f"post {post_id} (author {authors.get(post_id, 'unknown')}) was retweeted by {len(users)} accounts; "
                f"{len(new_accounts)} created <{NEW_ACCOUNT_DAYS} days ago, {len(flagged)} flagged."
            ),
            "node_ids": [post_id, *sorted(users)],
        })

    # Shared infrastructure.
    ip_users: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        if edge["type"] == "POSTED_FROM":
            ip_users[str(edge["target"])].add(str(edge["source"]))
    shared = sorted(((ip, users) for ip, users in ip_users.items() if len(users) >= 2), key=lambda item: -len(item[1]))
    for index, (ip_id, users) in enumerate(shared[:6], start=1):
        props = by_id.get(ip_id, {}).get("props", {})
        findings.append({
            "key": f"I{index}",
            "kind": "shared_infrastructure",
            "text": (
                f"{len(users)} accounts connect from {ip_id} ({props.get('address', '?')}, "
                f"network={props.get('network_type', 'unknown')}, region={props.get('geo_region', '?')})."
            ),
            "node_ids": [ip_id, *sorted(users)],
        })
    return findings


def _account_age_days(node: dict[str, Any] | None, now: datetime) -> int | None:
    if not node or node.get("label") != "User":
        return None
    created = _parse_time(node.get("props", {}).get("created_at"))
    return (now - created).days if created else None


def _clip(text: str, limit: int = MAX_TEXT_CHARS) -> str:
    text = " ".join(str(text).split()).replace('"', "'")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _short_time(value: Any) -> str:
    parsed = _parse_time(value)
    return parsed.strftime("%Y-%m-%dT%H:%MZ") if parsed else "?"


def serialize_node(node: dict[str, Any], now: datetime) -> str:
    props = node.get("props", {})
    node_id, label = node["id"], node["label"]
    if label == "User":
        age = _account_age_days(node, now)
        parts = [
            f"handle={props.get('handle', '?')}",
            f"platform={props.get('platform', '?')}",
            f"followers={props.get('follower_count', '?')}",
            f"account_age_days={age if age is not None else '?'}",
            f"flagged={str(bool(props.get('flagged'))).lower()}",
        ]
    elif label == "Post":
        parts = [
            f"at={_short_time(props.get('timestamp'))}",
            f"platform={props.get('platform', '?')}",
            f"severity={props.get('severity', '?')}",
            f'text="{_clip(props.get("text", ""))}"',
        ]
    elif label == "Hashtag":
        parts = [f"tag={props.get('tag', '?')}"]
    else:
        parts = [
            f"address={props.get('address', '?')}",
            f"region={props.get('geo_region', '?')}",
            f"network={props.get('network_type', 'unknown')}",
        ]
    return f"{label} {node_id} " + " ".join(parts)


def serialize_context(context: InvestigationContext, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    lines = [
        f"SUBGRAPH nodes={len(context.nodes)} of {context.nodes_in_filter} in filter, edges={len(context.edges)}"
        + (" (truncated to the most relevant evidence)" if context.truncated else ""),
    ]
    if context.focus_node_ids:
        lines.append("ANALYST FOCUS: " + ", ".join(context.focus_node_ids))
    lines.append("NODES")
    lines.extend(serialize_node(node, now) for node in context.nodes)
    lines.append("EDGES")
    for edge in context.edges:
        stamp = f" @{_short_time(edge['timestamp'])}" if edge.get("timestamp") else ""
        lines.append(f"{edge['source']} -{edge['type']}-> {edge['target']}{stamp}")
    lines.append("DETECTOR FINDINGS (deterministic OmniGraph analytics; cite by key and node IDs)")
    if context.findings:
        for finding in context.findings:
            ids = finding["node_ids"]
            shown = ", ".join(ids[:14]) + (f", +{len(ids) - 14} more" if len(ids) > 14 else "")
            lines.append(f"[{finding['key']}] {finding['kind']}: {finding['text']} ids=[{shown}]")
    else:
        lines.append("(none — no detector fired for this filter)")
    return "\n".join(lines)
