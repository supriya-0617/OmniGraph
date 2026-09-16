# 03 — Tech Stack

Status: frontend/graph-lib/DB choices are **locked**. LLM choice is **pending**.

## Frontend

| Choice | React + Vite |
|---|---|
| Why | Faster project setup than Next.js, no need for SSR/routing conventions for an internal dashboard-style tool. Vite's dev server and HMR keep iteration fast for a graph-canvas-heavy UI. |
| Alternative considered | Next.js — rejected for this project because SSR/file-based routing add complexity with no real benefit here (no SEO need, no server-rendered pages). |

## Graph visualization

| Choice | Cytoscape.js |
|---|---|
| Why | Built-in graph algorithms (centrality, layouts, clustering helpers) reduce how much of `07_ANALYTICS.md`'s metrics need to be hand-rolled on the backend; simpler styling API; large community/examples for interactive network UIs. |
| Alternative considered | Sigma.js — better raw WebGL performance at very large node counts, but this project's simulated datasets don't need that scale, and Cytoscape's algorithm library is worth more here than raw rendering speed. |

## Charts / analytics dashboard

| Choice | Recharts |
|---|---|
| Why | Named directly in the synopsis; integrates cleanly with React; sufficient for KPI cards, time-series, and bar/line charts needed for the dashboard. |

## Backend

| Choice | Python, FastAPI |
|---|---|
| Why | Native fit with the Neo4j Python driver, LangChain/LlamaIndex, and the broader Python AI ecosystem; async support suits I/O-bound graph queries and LLM calls; auto-generated OpenAPI docs help the team divide API work. |

## Database

| Choice | Neo4j, hosted on Neo4j Aura (cloud) |
|---|---|
| Why | Native graph storage/querying (Cypher) avoids the heavy JOINs a relational DB would need for multi-hop relationship queries — this is the whole thesis of the project. Aura's free tier removes local setup/ops burden for a 3-person team working across machines. |
| Alternative considered | Local Neo4j via Docker — rejected for this team because it requires every member to keep a local instance in sync or stand up shared infra; Aura gives one shared instance out of the box. |

## GraphRAG orchestration

| Choice | LangChain or LlamaIndex (pick one during Phase 3 implementation, not before — both fit) |
|---|---|
| Why | Both provide graph-aware retrieval abstractions and reduce boilerplate for prompt construction and LLM calling; final pick can be made when Phase 3 starts based on whichever has better docs for Neo4j sub-graph retrieval at that time. |

## LLM (GraphRAG "AI Forensic Analyst") — **pending decision**

Currently leaning **Gemini**, not finalized. Whatever is chosen:
- Must be called through a single adapter function/module (see `AGENTS.md`), so switching providers later is a one-file change, not a refactor.
- Needs to accept a text prompt containing serialized sub-graph structure + post content and return free-text analysis (no special multimodal or fine-tuning requirements identified so far).

## Auth

Not explicitly decided yet — default assumption: JWT-based auth implemented directly in FastAPI (register/login endpoints, password hashing via `passlib`, tokens via `python-jose` or similar). No third-party auth provider needed for a course project of this scope unless the team wants to save implementation time.

## Deployment (tentative)

- Frontend → Vercel or Netlify (static build)
- Backend → Render or Railway
- Database → Neo4j Aura (already cloud)

These can change if the team hits free-tier limits during testing — revisit closer to the 10-11-2026 submission date.
