# AGENTS.md — OmniGraph

This file orients any AI coding agent (Claude Code, Copilot, etc.) working in this repository. Read this first, then the relevant file(s) under `docs/` before making changes.

## What this project is

OmniGraph is an OSINT & disinformation-network analyzer. It ingests simulated social-media activity, models it as a graph (users, posts, hashtags, IPs and their interactions), lets an analyst filter/explore that graph on a dashboard, and lets the analyst ask an embedded AI ("GraphRAG Forensic Analyst") natural-language questions about a filtered sub-graph.

Course project for 24CIE554 (Full Stack Development). Three graded milestones — see `docs/11_IMPLEMENTATION_PLAN.md` for dates and scope per milestone.

## Locked-in stack (do not silently substitute)

| Layer | Choice |
|---|---|
| Frontend | React + Vite (plain SPA, no Next.js) |
| Graph rendering | Cytoscape.js |
| Charts/analytics | Recharts |
| Backend | Python, FastAPI |
| Database | Neo4j, hosted on Neo4j Aura (cloud) |
| GraphRAG orchestration | LangChain or LlamaIndex (see `docs/06_GRAPHRAG.md`) |
| LLM | Currently leaning Gemini — **not finalized**, keep the LLM call behind one adapter function so swapping providers is a one-file change |

Full rationale in `docs/03_TECH_STACK.md`.

## Repo layout (target)

```
/frontend      React + Vite app
/backend       FastAPI app
/docs          Design docs (this folder's sibling) — source of truth for scope
AGENTS.md
README.md
```

`/frontend` and `/backend` don't exist yet — they get created in Phase 1/2 per `docs/11_IMPLEMENTATION_PLAN.md`.

## Ground rules for agents

1. **Docs are the spec.** Before implementing a feature, check the matching doc (schema → `04`, an endpoint → `08`, a screen → `10`). If a doc and a request conflict, flag it rather than guessing.
2. **Don't add new top-level dependencies** (a new DB, a new state-management library, a different graph-viz lib) without calling it out — the stack above was deliberately chosen and is what the team will be graded on being able to explain.
3. **Keep the LLM call isolated.** All GraphRAG/LLM calls go through a single module (`backend/app/ai/llm_client.py` or equivalent) so the provider can change without touching business logic.
4. **Simulated data is fine and expected.** The synopsis explicitly describes "simulated live-streamed data" — don't scope-creep into building a real social-media scraper.
5. **Every feature that touches the DB needs a matching Cypher query documented or referenced in `04_GRAPH_SCHEMA.md`** so the team can explain the schema in a viva/demo.
6. **Auth**: implement JWT-based auth (register/login) unless a doc says otherwise — this is required for the Phase-1 backend milestone ("basic API integration (Login/Register or one module)").
7. **Commit in reviewable chunks** aligned to the phases in `11_IMPLEMENTATION_PLAN.md`, not one giant commit.

## Where to start

New to the repo? Read in this order: `README.md` → `docs/01_PRD.md` → `docs/02_SYSTEM_ARCHITECTURE.md` → `docs/03_TECH_STACK.md` → whichever doc matches the task at hand.
