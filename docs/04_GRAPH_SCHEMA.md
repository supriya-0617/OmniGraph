# 04 — Graph Schema (Neo4j)

## 1. Node labels & properties

### `:User`
| Property | Type | Notes |
|---|---|---|
| `id` | string (uuid) | unique |
| `handle` | string | display username |
| `platform` | string | e.g. "X", "Facebook" — simulated |
| `created_at` | datetime | account creation (simulated) |
| `follower_count` | integer | simulated |
| `ip_hash` | string | link to `:IPAddress`, also stored as its own node/edge |
| `flagged` | boolean | manually/heuristically flagged as suspicious |

### `:Post`
| Property | Type | Notes |
|---|---|---|
| `id` | string (uuid) | unique |
| `text` | string | post content — this is what GraphRAG reasons over |
| `timestamp` | datetime | used for date-wise filtering |
| `platform` | string | |
| `severity` | float or enum | threat/severity score — heuristic or seeded |
| `language` | string | optional |

### `:Hashtag`
| Property | Type |
|---|---|
| `id` | string |
| `tag` | string, unique |

### `:IPAddress`
| Property | Type |
|---|---|
| `id` | string |
| `address` | string (can be a fake/simulated IP) |
| `geo_region` | string, optional |
| `network_type` | string, optional — `datacenter`, `vpn`, `proxy`, `residential`, `corporate`, `university`; feeds the cluster risk score's *infrastructure* factor (unknown = 0.5) |

### `:Account` (login users of the OmniGraph app itself — not the OSINT `:User` entities)
| Property | Type |
|---|---|
| `id` | string |
| `email` | string, unique |
| `password_hash` | string |
| `created_at` | datetime |

> Keep `:Account` (app users/analysts) separate from `:User` (simulated social-media accounts being analyzed) — don't conflate them.

## 2. Relationship types

| Relationship | From → To | Properties | Meaning |
|---|---|---|---|
| `POSTED` | `(:User)-[:POSTED]->(:Post)` | `timestamp` | authorship |
| `RETWEETED` | `(:User)-[:RETWEETED]->(:Post)` | `timestamp` | amplification |
| `REPLIED_TO` | `(:Post)-[:REPLIED_TO]->(:Post)` | `timestamp` | reply thread |
| `MENTIONS` | `(:Post)-[:MENTIONS]->(:Hashtag)` | — | topical link |
| `TAGGED_USER` | `(:Post)-[:TAGGED_USER]->(:User)` | — | @-mention |
| `POSTED_FROM` | `(:User)-[:POSTED_FROM]->(:IPAddress)` | `timestamp` | infra link, key for bot-coordination detection |
| `FOLLOWS` | `(:User)-[:FOLLOWS]->(:User)` | — | optional, only if the seed data models it |

## 3. Example Cypher

**Get everything for a filtered window (date range + platform + min severity):**
```cypher
MATCH (u:User)-[:POSTED]->(p:Post)
WHERE p.timestamp >= $from AND p.timestamp <= $to
  AND p.platform = $platform
  AND p.severity >= $minSeverity
OPTIONAL MATCH (p)-[:MENTIONS]->(h:Hashtag)
OPTIONAL MATCH (other:User)-[:RETWEETED]->(p)
RETURN u, p, h, other
```

**Coordination signal — users sharing an IP who posted similar hashtags in a tight window:**
```cypher
MATCH (u1:User)-[:POSTED_FROM]->(ip:IPAddress)<-[:POSTED_FROM]-(u2:User)
WHERE u1.id <> u2.id
MATCH (u1)-[:POSTED]->(p1:Post)-[:MENTIONS]->(h:Hashtag)<-[:MENTIONS]-(p2:Post)<-[:POSTED]-(u2)
WHERE abs(duration.inSeconds(p1.timestamp, p2.timestamp).seconds) < 3600
RETURN ip, u1, u2, h, p1, p2
```

**Sub-graph extraction for GraphRAG (given a filter, return a bounded neighborhood):**
```cypher
MATCH (p:Post)
WHERE p.timestamp >= $from AND p.timestamp <= $to AND p.severity >= $minSeverity
CALL {
  WITH p
  MATCH (p)-[r*1..2]-(neighbor)
  RETURN collect(DISTINCT neighbor) AS neighbors, collect(DISTINCT r) AS rels
}
RETURN p, neighbors, rels
LIMIT 200
```
(Cap with `LIMIT`/hop-depth to keep the sub-graph small enough to serialize into an LLM prompt — see `06_GRAPHRAG.md`.)

## 4. Indexes (create early, before seeding at scale)

```cypher
CREATE INDEX post_timestamp IF NOT EXISTS FOR (p:Post) ON (p.timestamp);
CREATE INDEX post_severity IF NOT EXISTS FOR (p:Post) ON (p.severity);
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT post_id_unique IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT hashtag_id_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.id IS UNIQUE;
CREATE CONSTRAINT hashtag_tag_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.tag IS UNIQUE;
CREATE CONSTRAINT ip_id_unique IF NOT EXISTS FOR (ip:IPAddress) REQUIRE ip.id IS UNIQUE;
CREATE CONSTRAINT account_email_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.email IS UNIQUE;
```

Entity writes use parameterized `CREATE`/`SET` queries with labels fixed by the route. Creating a post can add its authorship and hashtag relationships in the same request:

```cypher
CREATE (p:Post) SET p = $properties
WITH p
MATCH (u:User {id: $author_id})
MERGE (u)-[r:POSTED]->(p)
SET r.timestamp = p.timestamp
```

Hashtags are matched or created by their unique `tag`, then linked with `(:Post)-[:MENTIONS]->(:Hashtag)`. User IP changes replace the user's `POSTED_FROM` relationship and keep its `ip_hash` property synchronized. The API query implementations are in `backend/app/routes/entities.py`.

## 5. Phase 3 queries (analytics, GraphRAG, seeding)

All are parameterised; filter predicates come from `GraphFilters.post_predicates()`:
`($from_date IS NULL OR p.timestamp >= $from_date) AND ($to_date IS NULL OR p.timestamp <= $to_date) AND ($platform IS NULL OR p.platform = $platform) AND p.severity >= $min_severity`.

**Coordination pairs** — `backend/app/analytics.py::CLUSTER_PAIR_QUERY`. Python groups the pairs by (IP, hashtag) and computes window, severity, duplication and the risk score (`aggregate_clusters`). The in-memory store builds identical pair records.
```cypher
MATCH (u1:User)-[:POSTED_FROM]->(ip:IPAddress)<-[:POSTED_FROM]-(u2:User)
WHERE u1.id < u2.id
MATCH (u1)-[:POSTED]->(p1:Post)-[:MENTIONS]->(h:Hashtag)<-[:MENTIONS]-(p2:Post)<-[:POSTED]-(u2)
WHERE p1.id <> p2.id
  AND abs(duration.inSeconds(p1.timestamp, p2.timestamp).seconds) <= $window_seconds   // 3600
  AND <predicates on p1> AND <predicates on p2>
RETURN ip.id, ip.address, ip.network_type, h.tag,
       u1.id, u1.handle, u1.flagged, u2.id, u2.handle, u2.flagged,
       p1.id, p1.timestamp, p1.severity, p1.text, p1.platform,
       p2.id, p2.timestamp, p2.severity, p2.text, p2.platform
```

**Dashboard summary** — `backend/app/routes/analytics.py::SUMMARY_QUERY` (one round trip; `$post_ids` is the cluster post set when `min_density > 1`, otherwise `null`). It is run twice when a date range is set: once for the window, once for the previous equal-length window (KPI trends).
```cypher
MATCH (p:Post)
WHERE <predicates> AND ($post_ids IS NULL OR p.id IN $post_ids)
WITH collect(p) AS posts
CALL { WITH posts UNWIND posts AS p
       RETURN count(p) AS total_posts, avg(p.severity) AS avg_severity,
              sum(CASE WHEN p.severity >= $high THEN 1 ELSE 0 END) AS high_severity_posts }
CALL { WITH posts UNWIND posts AS p
       OPTIONAL MATCH (u:User)-[r:POSTED|RETWEETED]->(p)
       RETURN count(DISTINCT CASE WHEN type(r) = 'POSTED' THEN u END) AS total_accounts,
              count(DISTINCT CASE WHEN u.flagged = true THEN u END) AS total_flagged_users }
CALL { WITH posts UNWIND posts AS p
       RETURN collect({bucket: toString(date(p.timestamp)), count: 1,
                       high: CASE WHEN p.severity >= $high THEN 1 ELSE 0 END}) AS day_rows }
CALL { WITH posts UNWIND posts AS p MATCH (p)-[:MENTIONS]->(h:Hashtag)
       WITH h.tag AS tag, count(DISTINCT p) AS count ORDER BY count DESC, tag LIMIT 10
       RETURN collect({tag: tag, count: count}) AS top_hashtags }
CALL { WITH posts UNWIND posts AS p
       WITH coalesce(p.platform, 'Unknown') AS platform, count(p) AS count ORDER BY count DESC
       RETURN collect({platform: platform, count: count}) AS platform_breakdown }
RETURN total_posts, avg_severity, high_severity_posts, total_accounts, total_flagged_users,
       day_rows, top_hashtags, platform_breakdown, [p IN posts | p.severity] AS severities
```

**GraphRAG retrieval** — `POST /ai/query` reuses the `GET /graph` queries (`backend/app/routes/graph.py`) and the coordination-pair query above; prioritisation and bounding (120 nodes / 260 edges) happen in `backend/app/ai/context.py`. No extra Cypher is sent to the model.

**Public landing stats** — `GET /public/stats` (counts only, cached 60 s): `MATCH (n:User) RETURN count(n)` (likewise `Post`, `Hashtag`, `IPAddress`).

**Session check** — `GET /auth/me` only decodes the JWT; no query.

**Seeding** — `backend/scripts/seed_data.py` writes the dataset from `backend/app/data/synthetic.py` in batches of 500:
```cypher
UNWIND $rows AS row MERGE (n:User {id: row.id}) SET n += row          // likewise Post, IPAddress
UNWIND $rows AS row MERGE (n:Hashtag {tag: row.tag}) SET n.id = row.id
UNWIND $rows AS row
MATCH (a:User {id: row.source}) MATCH (b:Post {id: row.target})        // labels per relationship type
MERGE (a)-[r:POSTED]->(b) SET r += row.props
// --reset (Account nodes are never touched):
MATCH (n) WHERE n:User OR n:Post OR n:Hashtag OR n:IPAddress
CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 1000 ROWS
```
An extra index `post_platform` is created alongside the §4 constraints.

**Live-stream simulator** (optional, `SIMULATOR_ENABLED=true`) — `backend/app/simulator.py`:
```cypher
MATCH (u:User {id: $author_id})
MERGE (p:Post {id: $id})
SET p.text = $text, p.timestamp = datetime($timestamp), p.platform = u.platform,
    p.severity = $severity, p.language = $language
MERGE (u)-[r:POSTED]->(p) SET r.timestamp = p.timestamp
WITH p UNWIND $hashtags AS tag
MERGE (h:Hashtag {tag: tag}) ON CREATE SET h.id = randomUUID()
MERGE (p)-[:MENTIONS]->(h)
```
