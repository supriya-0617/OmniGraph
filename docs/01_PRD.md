# 01 — Product Requirements Document

## 1. Problem

Disinformation and coordinated inauthentic behavior spread through networks of accounts, posts, and shared narratives. Relational (row/column) analysis struggles to surface the *structure* of these networks — who's connected to whom, which node a narrative originated from, which clusters look artificially coordinated. Analysts need a tool that treats the network itself as the primary object of analysis, not an afterthought.

## 2. Goal

Build a full-stack OSINT platform that (a) represents social activity as a graph, (b) lets an analyst filter and visually explore that graph, and (c) lets the analyst query an AI that reasons over the *currently filtered sub-graph* — both its structure and its text — to produce forensic-style insights.

## 3. Target user / persona

**The Analyst** — a threat-intelligence or trust & safety investigator who is graph-literate but not a data scientist. They think in terms of "show me everything connected to this hashtag in the last 48 hours" or "is this cluster a botnet," not in terms of Cypher queries or embeddings.

## 4. Scope (in / out)

**In scope**
- Simulated ingestion of social posts, users, hashtags, IP addresses, and their interactions (retweet, reply, mention, post) into Neo4j.
- A graph-exploration UI (Cytoscape.js canvas) with filters by date, severity/threat level, platform, and interaction density.
- Node/edge computed metrics: degree/interaction centrality, cluster/community detection (at minimum a simple connected-components or louvain-style grouping), post frequency over time.
- An analytics dashboard (Recharts) surfacing the above as charts, tables, and KPIs.
- A GraphRAG chat panel: the analyst asks a question about the current filtered view; the backend extracts that sub-graph, passes structure + text to an LLM, and returns a forensic-style answer (e.g., likely origin node, coordination pattern flags, narrative summary).
- Auth (register/login), so activity/investigations can be scoped to a user.
- CRUD endpoints for the core entities (mainly for seeding/managing simulated data and any analyst annotations).

**Out of scope**
- Real live scraping of social platforms (explicitly simulated data per the synopsis).
- Production-grade abuse/threat classification models — severity/threat level can be simulated/rule-based or a lightweight heuristic, not a trained classifier.
- Multi-tenant organization/team management beyond basic auth.

## 5. Key features (mapped to grading rubric)

| Rubric requirement | How OmniGraph satisfies it |
|---|---|
| AI Assistant/Chatbot integrated with app data | GraphRAG Forensic Analyst — queries the live filtered sub-graph, not a static FAQ |
| Data Analytics module with filters | Dashboard: date/severity/platform/density filters over the same graph data |
| AI + Analytics demonstration | Chat panel operates *on the filtered dashboard state* — filtering first, then asking the AI, is the core demo flow |

## 6. Success criteria

- An analyst can filter the graph to a specific cluster and see updated charts/KPIs within the same session, no reload.
- Asking the AI a question about the current filter returns an answer that references specific nodes/structure from that filter (not a generic response).
- All three phases (frontend, backend, AI+analytics) demoable end-to-end by the final submission date.

## 7. Non-functional requirements

- Graph canvas should stay responsive up to a few hundred nodes rendered at once (simulated dataset size, not production scale).
- Auth required for any write/CRUD operation; read-only graph exploration can be public within the app if the team wants a simpler demo flow — decide before Phase 2.
- LLM calls must be swappable behind one adapter (see `AGENTS.md`) since the model choice isn't finalized.

## 8. Open questions (track and resolve during Phase 1–2)

- Exact severity/threat-level scoring rule (heuristic formula vs. manual tagging in seed data).
- Whether "date-wise" filtering uses simulated post timestamps or ingestion timestamps.
- Final LLM provider (currently leaning Gemini, not locked in).
