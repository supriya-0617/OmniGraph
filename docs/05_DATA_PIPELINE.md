# 05 — Data Pipeline (Simulated Ingestion)

The synopsis specifies **simulated live-streamed data**, not a real scraper. This doc defines how that simulation is generated, normalized, and loaded into Neo4j.

## 1. Why simulated

- Avoids ToS/legal issues with scraping real platforms for a course project.
- Lets the team control severity/threat-level distribution so the analytics and AI demo have interesting patterns to show (e.g., guaranteed botnet clusters).
- Reproducible: same seed script produces the same demo data every time.

## 2. Generation approach

A Python seed script (`backend/scripts/seed_data.py`) generates:
1. A pool of `:User` nodes with varied `follower_count`, `platform`, and a subset flagged for shared `:IPAddress` (to simulate botnets).
2. A pool of `:Hashtag` nodes representing 3–5 fake "narratives."
3. A stream of `:Post` nodes authored by users over a simulated time window (e.g., past 30 days), each tagged with 1–2 hashtags and a `severity` score.
4. Interaction edges: `RETWEETED`, `REPLIED_TO`, `TAGGED_USER` generated with a bias so that flagged/botnet users interact with each other more densely than organic users — this is what makes the "detect coordination" demo work.
5. A handful of deliberately obvious "coordinated cluster" scenarios (e.g., 10 accounts on the same IP posting the same hashtag within minutes) so the AI/analytics demo has a clear "aha" moment.

Use a library like `Faker` for realistic-looking (but fake) text/handles, and a fixed random seed so the dataset is reproducible for the demo.

## 3. Loading into Neo4j

- Seed script uses the official `neo4j` Python driver, batches `UNWIND`-based Cypher writes (much faster than one write per node for a few thousand rows).
- Idempotent: script should be safe to re-run (e.g., `MERGE` on unique keys rather than `CREATE`) so the team can reset/reseed during development without duplicate data.
- Run indexes/constraints from `04_GRAPH_SCHEMA.md` **before** bulk loading.

## 4. "Live-streamed" simulation (optional stretch)

If the team wants to demo something feeling closer to a live feed:
- A background task (FastAPI `BackgroundTasks` or a simple loop) that inserts a small number of new posts/interactions every N seconds while the app is running, so the dashboard visibly updates.
- This is a nice-to-have for the demo, not required for the core rubric — treat as stretch scope once Phase 3 core work is done.

## 5. Data volume guidance

Keep the total seeded graph in the low thousands of nodes (e.g., 200–500 users, 2,000–5,000 posts) — enough to make filtering and clustering meaningful without stressing the free-tier Aura instance or the Cytoscape.js canvas.

## 6. Database-free development fixture

When `NEO4J_URI` is unset, the backend uses a deterministic in-memory graph fixture instead of connecting to a database. It generates 200 users and 2,000 posts across simulated platforms, with shared-IP coordination bursts and representative reply, retweet, follow, mention, and tagged-user relationships. This fixture is loaded at process startup, is reproducible, and is discarded when the process stops. It supports local Phase 2 API and dashboard work; it does not replace persistent Neo4j setup for the course milestone.
