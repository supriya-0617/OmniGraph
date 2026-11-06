"""Seed Neo4j / Aura with the OmniGraph simulated dataset (docs/05_DATA_PIPELINE.md §3).

    python scripts/seed_data.py            # idempotent MERGE of the full dataset
    python scripts/seed_data.py --reset    # delete simulated OSINT data first (keeps :Account logins)

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
    "Hashtag": "UNWIND $rows AS row MERGE (n:Hashtag {tag: row.tag}) SET n.id = row.id",
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


def run_seed(reset: bool = False) -> bool:
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
        if reset:
            logger.info("Removing existing simulated OSINT data (Account nodes are kept)...")
            session.run(
                "MATCH (n) WHERE n:User OR n:Post OR n:Hashtag OR n:IPAddress "
                "CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 1000 ROWS"
            ).consume()

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
        for relation, rows in by_type.items():
            source_label, target_label = EDGE_ENDPOINTS[relation]
            query = (
                f"UNWIND $rows AS row "
                f"MATCH (a:{source_label} {{id: row.source}}) MATCH (b:{target_label} {{id: row.target}}) "
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
    parser.add_argument("--reset", action="store_true", help="delete simulated OSINT nodes before seeding")
    raise SystemExit(0 if run_seed(reset=parser.parse_args().reset) else 1)
