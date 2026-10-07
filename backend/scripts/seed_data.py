import sys
import os
import logging
from datetime import datetime, timezone, timedelta

# Ensure app package is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("omnigraph.seed")

CONSTRAINTS_AND_INDEXES = [
    "CREATE INDEX post_timestamp IF NOT EXISTS FOR (p:Post) ON (p.timestamp);",
    "CREATE INDEX post_severity IF NOT EXISTS FOR (p:Post) ON (p.severity);",
    "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;",
    "CREATE CONSTRAINT post_id_unique IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE;",
    "CREATE CONSTRAINT hashtag_id_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.id IS UNIQUE;",
    "CREATE CONSTRAINT hashtag_tag_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.tag IS UNIQUE;",
    "CREATE CONSTRAINT ip_id_unique IF NOT EXISTS FOR (ip:IPAddress) REQUIRE ip.id IS UNIQUE;",
    "CREATE CONSTRAINT account_email_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.email IS UNIQUE;"
]

SAMPLE_USERS = [
    {"id": "u_001", "handle": "@alpha_intel", "platform": "X", "follower_count": 15400, "flagged": False, "ip_hash": "ip_101"},
    {"id": "u_002", "handle": "@truth_seeker", "platform": "X", "follower_count": 820, "flagged": False, "ip_hash": "ip_102"},
    {"id": "u_003", "handle": "@nexus_news", "platform": "Telegram", "follower_count": 45000, "flagged": False, "ip_hash": "ip_103"},
    {"id": "u_004", "handle": "@shadow_bot01", "platform": "X", "follower_count": 12, "flagged": True, "ip_hash": "ip_200"},
    {"id": "u_005", "handle": "@shadow_bot02", "platform": "X", "follower_count": 5, "flagged": True, "ip_hash": "ip_200"},
    {"id": "u_006", "handle": "@shadow_bot03", "platform": "X", "follower_count": 8, "flagged": True, "ip_hash": "ip_200"},
    {"id": "u_007", "handle": "@cyber_sentinel", "platform": "Facebook", "follower_count": 3200, "flagged": False, "ip_hash": "ip_104"},
    {"id": "u_008", "handle": "@echo_chamber99", "platform": "Telegram", "follower_count": 110, "flagged": True, "ip_hash": "ip_201"},
    {"id": "u_009", "handle": "@narrative_node", "platform": "X", "follower_count": 430, "flagged": False, "ip_hash": "ip_105"},
    {"id": "u_010", "handle": "@global_watcher", "platform": "X", "follower_count": 9800, "flagged": False, "ip_hash": "ip_106"}
]

SAMPLE_IP_ADDRESSES = [
    {"id": "ip_101", "address": "198.51.100.14", "geo_region": "US-East"},
    {"id": "ip_102", "address": "198.51.100.22", "geo_region": "EU-Central"},
    {"id": "ip_103", "address": "198.51.100.89", "geo_region": "ASIA-East"},
    {"id": "ip_104", "address": "203.0.113.45", "geo_region": "US-West"},
    {"id": "ip_105", "address": "203.0.113.78", "geo_region": "EU-West"},
    {"id": "ip_106", "address": "203.0.113.91", "geo_region": "US-Central"},
    {"id": "ip_200", "address": "192.0.2.100", "geo_region": "UNKNOWN-PROXY"},  # Shared Botnet IP
    {"id": "ip_201", "address": "192.0.2.105", "geo_region": "UNKNOWN-PROXY"}
]

SAMPLE_HASHTAGS = [
    {"id": "h_001", "tag": "#DisinfoCampaign"},
    {"id": "h_002", "tag": "#BotnetDetected"},
    {"id": "h_003", "tag": "#DeepFakeAlert"},
    {"id": "h_004", "tag": "#CyberSecurity"},
    {"id": "h_005", "tag": "#OSINTInvestigates"}
]

NOW = datetime.now(timezone.utc)

SAMPLE_POSTS = [
    {
        "id": "p_001",
        "author_id": "u_001",
        "text": "Breaking OSINT alert: Unexplained spike in synthetic network activity detected across regional nodes.",
        "timestamp": (NOW - timedelta(days=2)).isoformat(),
        "platform": "X",
        "severity": 0.85,
        "language": "en",
        "hashtags": ["#DisinfoCampaign", "#OSINTInvestigates"],
        "ip_id": "ip_101"
    },
    {
        "id": "p_002",
        "author_id": "u_004",
        "text": "URGENT: System breakdown imminent! Re-post before it gets censored!",
        "timestamp": (NOW - timedelta(hours=36)).isoformat(),
        "platform": "X",
        "severity": 0.92,
        "language": "en",
        "hashtags": ["#BotnetDetected", "#DisinfoCampaign"],
        "ip_id": "ip_200"
    },
    {
        "id": "p_003",
        "author_id": "u_005",
        "text": "URGENT: System breakdown imminent! Re-post before it gets censored!",
        "timestamp": (NOW - timedelta(hours=35, minutes=50)).isoformat(),
        "platform": "X",
        "severity": 0.92,
        "language": "en",
        "hashtags": ["#BotnetDetected", "#DisinfoCampaign"],
        "ip_id": "ip_200"
    },
    {
        "id": "p_004",
        "author_id": "u_006",
        "text": "URGENT: System breakdown imminent! Re-post before it gets censored!",
        "timestamp": (NOW - timedelta(hours=35, minutes=45)).isoformat(),
        "platform": "X",
        "severity": 0.92,
        "language": "en",
        "hashtags": ["#BotnetDetected", "#DisinfoCampaign"],
        "ip_id": "ip_200"
    },
    {
        "id": "p_005",
        "author_id": "u_003",
        "text": "Detailed telemetry graph analysis on emerging automated amplification networks.",
        "timestamp": (NOW - timedelta(days=1)).isoformat(),
        "platform": "Telegram",
        "severity": 0.40,
        "language": "en",
        "hashtags": ["#CyberSecurity"],
        "ip_id": "ip_103"
    },
    {
        "id": "p_006",
        "author_id": "u_007",
        "text": "Synthetic media circulating regarding recent grid operations. Verify sources.",
        "timestamp": (NOW - timedelta(hours=12)).isoformat(),
        "platform": "Facebook",
        "severity": 0.65,
        "language": "en",
        "hashtags": ["#DeepFakeAlert"],
        "ip_id": "ip_104"
    }
]

def run_seed():
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USER
    password = settings.NEO4J_PASSWORD

    logger.info(f"Connecting to Neo4j database at {uri}...")
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
    except Exception as e:
        logger.warning(f"Could not connect to Neo4j instance at {uri}: {e}")
        logger.info("==========================================================================")
        logger.info("NOTE: Neo4j database is currently offline or not configured in .env.")
        logger.info("To seed live Neo4j Aura cloud database:")
        logger.info("1. Copy .env.example to .env")
        logger.info("2. Set NEO4J_URI=neo4j+s://<your-aura-instance>.databases.neo4j.io")
        logger.info("3. Set NEO4J_USER=neo4j and NEO4J_PASSWORD=<your-password>")
        logger.info("4. Re-run: python scripts/seed_data.py")
        logger.info("==========================================================================")
        return

    with driver.session() as session:
        # Step 1: Create Constraints & Indexes
        logger.info("Setting up Cypher schema constraints and indexes...")
        for query in CONSTRAINTS_AND_INDEXES:
            try:
                session.run(query)
            except Exception as e:
                logger.warning(f"Schema query info: {e}")

        # Step 2: Seed Users
        logger.info("Seeding :User nodes...")
        for u in SAMPLE_USERS:
            session.run("""
                MERGE (u:User {id: $id})
                SET u.handle = $handle,
                    u.platform = $platform,
                    u.follower_count = $follower_count,
                    u.flagged = $flagged,
                    u.ip_hash = $ip_hash,
                    u.created_at = datetime()
            """, u)

        # Step 3: Seed IPAddresses
        logger.info("Seeding :IPAddress nodes...")
        for ip in SAMPLE_IP_ADDRESSES:
            session.run("""
                MERGE (i:IPAddress {id: $id})
                SET i.address = $address,
                    i.geo_region = $geo_region
            """, ip)

        # Step 4: Seed Hashtags
        logger.info("Seeding :Hashtag nodes...")
        for h in SAMPLE_HASHTAGS:
            session.run("""
                MERGE (h:Hashtag {id: $id})
                SET h.tag = $tag
            """, h)

        # Step 5: Seed User POSTED_FROM IPAddress relationships
        logger.info("Creating :POSTED_FROM relationships...")
        for u in SAMPLE_USERS:
            session.run("""
                MATCH (u:User {id: $u_id})
                MATCH (i:IPAddress {id: $ip_id})
                MERGE (u)-[:POSTED_FROM]->(i)
            """, u_id=u["id"], ip_id=u["ip_hash"])

        # Step 6: Seed Posts & Relationships
        logger.info("Seeding :Post nodes and interaction relationships...")
        for p in SAMPLE_POSTS:
            session.run("""
                MERGE (post:Post {id: $id})
                SET post.text = $text,
                    post.timestamp = datetime($timestamp),
                    post.platform = $platform,
                    post.severity = $severity,
                    post.language = $language
            """, p)

            # User POSTED Post
            session.run("""
                MATCH (u:User {id: $author_id})
                MATCH (p:Post {id: $post_id})
                MERGE (u)-[r:POSTED]->(p)
                SET r.timestamp = datetime($timestamp)
            """, author_id=p["author_id"], post_id=p["id"], timestamp=p["timestamp"])

            # Post MENTIONS Hashtag
            for tag_name in p["hashtags"]:
                session.run("""
                    MATCH (p:Post {id: $post_id})
                    MATCH (h:Hashtag {tag: $tag})
                    MERGE (p)-[:MENTIONS]->(h)
                """, post_id=p["id"], tag=tag_name)

        # Step 7: Create retweet amplification edges for botnet demo
        session.run("""
            MATCH (u2:User {id: 'u_005'}), (p1:Post {id: 'p_002'})
            MERGE (u2)-[r:RETWEETED]->(p1)
            SET r.timestamp = datetime()
        """)
        session.run("""
            MATCH (u3:User {id: 'u_006'}), (p1:Post {id: 'p_002'})
            MERGE (u3)-[r:RETWEETED]->(p1)
            SET r.timestamp = datetime()
        """)

    driver.close()
    logger.info("OmniGraph Neo4j data seed completed successfully!")

if __name__ == "__main__":
    run_seed()
