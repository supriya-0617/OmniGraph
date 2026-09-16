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
CREATE CONSTRAINT hashtag_tag_unique IF NOT EXISTS FOR (h:Hashtag) REQUIRE h.tag IS UNIQUE;
CREATE CONSTRAINT account_email_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.email IS UNIQUE;
```
