"""Seed Neo4j / Aura with the OmniGraph simulated dataset (docs/05_DATA_PIPELINE.md §3).

    python scripts/seed_data.py               # idempotent MERGE of the full dataset
    python scripts/seed_data.py --dry-run     # pre-flight conflict check only, writes nothing
    python scripts/seed_data.py --reset       # first delete THIS dataset's nodes (usr_/pst_/tag_/net_ IDs)
    python scripts/seed_data.py --purge-demo  # also delete injected demo bursts (demo_* IDs)

Safe for a shared database: the dataset has its own ID namespace, existing nodes from other
seeds are never modified or deleted, :Account logins are never touched, and the script
refuses to write if any dataset ID already exists with different content.

Uses batched UNWIND writes and creates constraints/indexes before loading. Timestamps are
relative to the moment you run it, so re-run with --reset to refresh a stale demo window.
"""
import argparse
import logging
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from neo4j import GraphDatabase  # noqa: E402

from app.config import settings  # noqa: E402
from app.data.synthetic import generate_dataset  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("omnigraph.seed")
logging.getLogger("neo4j.notifications").setLevel(logging.WARNING)
BATCH = 500

SCHEMA = [
    "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    "CREATE CONSTRAINT post_id_unique IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT hashtag_id_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.id IS UNIQUE",
    "CREATE CONSTRAINT hashtag_tag_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.tag IS UNIQUE",
    "CREATE CONSTRAINT ip_id_unique IF NOT EXISTS FOR (ip:IPAddress) REQUIRE ip.id IS UNIQUE",
    "CREATE CONSTRAINT account_email_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.email IS UNIQUE",
    "CREATE INDEX post_timestamp IF NOT EXISTS FOR (p:Post) ON (p.timestamp)",
    "CREATE INDEX post_severity IF NOT EXISTS FOR (p:Post) ON (p.severity)",
    "CREATE INDEX post_platform IF NOT EXISTS FOR (p:Post) ON (p.platform)",
]

NODE_QUERIES = {
    "IPAddress": "UNWIND $rows AS row MERGE (n:IPAddress {id: row.id}) SET n += row",
    # Reuse an existing hashtag node with the same tag instead of rewriting its id.
    "Hashtag": "UNWIND $rows AS row MERGE (n:Hashtag {tag: row.tag}) ON CREATE SET n.id = row.id",
    "User": "UNWIND $rows AS row MERGE (n:User {id: row.id}) SET n += row",
    "Post": "UNWIND $rows AS row MERGE (n:Post {id: row.id}) SET n += row",
}

# Endpoint labels per relationship type (docs/04_GRAPH_SCHEMA.md §2).
EDGE_ENDPOINTS = {
    "POSTED": ("User", "Post"),
    "RETWEETED": ("User", "Post"),
    "REPLIED_TO": ("Post", "Post"),
    "MENTIONS": ("Post", "Hashtag"),
    "TAGGED_USER": ("Post", "User"),
    "POSTED_FROM": ("User", "IPAddress"),
    "FOLLOWS": ("User", "User"),
}


def _batches(rows):
    for start in range(0, len(rows), BATCH):
        yield rows[start : start + BATCH]


DATASET_PREFIXES = ["usr_", "pst_", "tag_", "net_"]
IDENTITY_FIELD = {"User": "handle", "Post": "text", "IPAddress": "address"}


def preflight(session, dataset) -> list[str]:
    """IDs that already exist with different content (would be overwritten)."""
    conflicts = []
    for label, field in IDENTITY_FIELD.items():
        rows = [{"id": node["id"], "value": node[field]} for node in dataset["nodes"][label].values()]
        records = session.run(
            f"UNWIND $rows AS row MATCH (n:{label} {{id: row.id}}) "
            f"WHERE n.{field} <> row.value RETURN n.id AS id LIMIT 20",
            rows=rows,
        )
        conflicts += [f"{label} {record['id']}" for record in records]
    tags = [{"id": node["id"], "tag": node["tag"]} for node in dataset["nodes"]["Hashtag"].values()]
    records = session.run(
        "UNWIND $rows AS row MATCH (h:Hashtag {id: row.id}) WHERE h.tag <> row.tag RETURN h.id AS id",
        rows=tags,
    )
    conflicts += [f"Hashtag {record['id']}" for record in records]
    return conflicts


def run_seed(reset: bool = False, purge_demo: bool = False, dry_run: bool = False) -> bool:
    if not settings.NEO4J_URI:
        logger.error("NEO4J_URI is not set. Add the Aura credentials to backend/.env first.")
        return False
    session_kwargs = {"database": settings.NEO4J_DATABASE} if settings.NEO4J_DATABASE else {}
    logger.info("Connecting to %s ...", settings.NEO4J_URI)
    driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD))
    try:
        with driver.session(**session_kwargs) as probe:
            probe.run("RETURN 1").consume()
    except Exception as error:
        logger.error("Could not connect to Neo4j: %s", error)
        logger.error("Check the Aura console (instance running? paused?) and NEO4J_* values in backend/.env.")
        driver.close()
        return False

    started = time.monotonic()
    dataset = generate_dataset()
    with driver.session(**session_kwargs) as session:
        before = session.run(
            "MATCH (n) RETURN labels(n)[0] AS label, count(*) AS count ORDER BY label"
        ).data()
        logger.info("Existing nodes: %s", before)

        if reset or purge_demo:
            prefixes = (DATASET_PREFIXES if reset else []) + (["demo_"] if purge_demo else [])
            logger.info("Deleting nodes whose id starts with %s (other data and :Account are kept)...", prefixes)
            session.run(
                "MATCH (n) WHERE (n:User OR n:Post OR n:Hashtag OR n:IPAddress) "
                "AND any(prefix IN $prefixes WHERE n.id STARTS WITH prefix) "
                "CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 1000 ROWS",
                prefixes=prefixes,
            ).consume()

        conflicts = preflight(session, dataset)
        if conflicts:
            logger.error("Refusing to seed: %d IDs already exist with different content: %s", len(conflicts), conflicts[:10])
            driver.close()
            return False
        logger.info("Pre-flight OK: no conflicting IDs.")
        if dry_run:
            driver.close()
            return True

        for statement in SCHEMA:
            session.run(statement).consume()

        for label in ("IPAddress", "Hashtag", "User", "Post"):
            rows = list(dataset["nodes"][label].values())
            for batch in _batches(rows):
                session.execute_write(lambda tx, b=batch: tx.run(NODE_QUERIES[label], rows=b).consume())
            logger.info("  %-9s %5d nodes", label, len(rows))

        by_type: dict[str, list] = {}
        for edge in dataset["edges"]:
            by_type.setdefault(edge["type"], []).append({
                "source": edge["source"],
                "target": edge["target"],
                "props": {k: v for k, v in edge["properties"].items() if v is not None},
            })
        tag_of = {node["id"]: node["tag"] for node in dataset["nodes"]["Hashtag"].values()}
        for relation, rows in by_type.items():
            source_label, target_label = EDGE_ENDPOINTS[relation]
            if target_label == "Hashtag":  # hashtags are matched by their unique tag
                rows = [{**row, "target": tag_of[row["target"]]} for row in rows]
                target_match = "MATCH (b:Hashtag {tag: row.target})"
            else:
                target_match = f"MATCH (b:{target_label} {{id: row.target}})"
            query = (
                f"UNWIND $rows AS row "
                f"MATCH (a:{source_label} {{id: row.source}}) {target_match} "
                f"MERGE (a)-[r:{relation}]->(b) SET r += row.props"
            )
            for batch in _batches(rows):
                session.execute_write(lambda tx, b=batch, q=query: tx.run(q, rows=b).consume())
            logger.info("  %-12s %5d relationships", relation, len(rows))

        counts = session.run(
            "MATCH (n) WHERE n:User OR n:Post OR n:Hashtag OR n:IPAddress "
            "RETURN labels(n)[0] AS label, count(*) AS count ORDER BY label"
        ).data()
    driver.close()
    logger.info("Seed complete in %.1fs: %s", time.monotonic() - started, counts)
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="delete this dataset's nodes (usr_/pst_/tag_/net_) first")
    parser.add_argument("--purge-demo", action="store_true", help="delete injected demo bursts (demo_* IDs) first")
    parser.add_argument("--dry-run", action="store_true", help="only run the pre-flight conflict check")
    args = parser.parse_args()
    raise SystemExit(0 if run_seed(reset=args.reset, purge_demo=args.purge_demo, dry_run=args.dry_run) else 1)
