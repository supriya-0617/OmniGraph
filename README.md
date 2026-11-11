# OmniGraph

**OSINT & Disinformation Network Analyzer**

Full Stack Development Project — Course 24CIE554

**Team**
- Swastik R Phadke — 1MS24CI130
- Raghav — 1MS24CI096
- Surpiya J — 1MS24CI129

## What it does

OmniGraph maps simulated social-media activity (users, posts, hashtags, IP addresses) into an explorable graph and gives an investigator a filtered graph, analytics dashboard, and evidence-grounded GraphRAG forensic analyst:

- **Current:** filter the network by severity, time window, platform, or coordination density; inspect accounts, posts, hashtags, and suspected clusters.
- **AI investigation:** ask natural-language questions about the currently filtered sub-graph, inspect structured evidence, and highlight supporting nodes.

## Tech stack

- **Frontend:** React + Vite, Cytoscape.js (graph rendering), Recharts (charts)
- **Backend:** Python, FastAPI
- **Database:** Neo4j (Aura, cloud-hosted)
- **AI:** hand-rolled GraphRAG pipeline (see `docs/06_GRAPHRAG.md`) with a swappable LLM adapter — Gemini by default

Full rationale: [`docs/03_TECH_STACK.md`](docs/03_TECH_STACK.md)

## Documentation

| Doc | Covers |
|---|---|
| [01_PRD.md](docs/01_PRD.md) | Product requirements, scope, success criteria |
| [02_SYSTEM_ARCHITECTURE.md](docs/02_SYSTEM_ARCHITECTURE.md) | High-level architecture & data flow |
| [03_TECH_STACK.md](docs/03_TECH_STACK.md) | Stack choices and why |
| [04_GRAPH_SCHEMA.md](docs/04_GRAPH_SCHEMA.md) | Neo4j node/relationship schema |
| [05_DATA_PIPELINE.md](docs/05_DATA_PIPELINE.md) | Simulated ingestion → graph construction |
| [06_GRAPHRAG.md](docs/06_GRAPHRAG.md) | Sub-graph extraction & LLM reasoning flow |
| [07_ANALYTICS.md](docs/07_ANALYTICS.md) | Dashboard filters, metrics, charts |
| [08_API_SPEC.md](docs/08_API_SPEC.md) | REST API endpoints |
| [09_USER_FLOWS.md](docs/09_USER_FLOWS.md) | End-to-end user journeys |
| [10_UI_UX_SPEC.md](docs/10_UI_UX_SPEC.md) | Screens, layout, components |
| [11_IMPLEMENTATION_PLAN.md](docs/11_IMPLEMENTATION_PLAN.md) | Phased plan mapped to grading milestones |

See [`AGENTS.md`](AGENTS.md) for conventions if you're using an AI coding assistant on this repo.

## Implementation Status

- **Phase 1:** UI/auth scaffolding and login/register complete.
- **Phase 2:** entity CRUD, JWT-protected graph/analytics APIs, fail-closed Neo4j handling, transactional writes.
- **Phase 3:** GraphRAG forensic analyst (prioritised bounded retrieval, deterministic detector findings, multi-provider LLM adapter, server-side evidence grounding, rate limiting), analytics upgrade (density-consistent aggregates, KPI trends, explainable five-factor risk score), shared realistic dataset for memory mode and Aura, "Evidence Room" design system across landing, auth and dashboard, deployment configs.
- **Remaining:** add `LLM_API_KEY`, deploy (Render + Vercel), Person-1 dashboard/graph refinements.

## Getting Started

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate             # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env             # then fill in values (Linux/macOS: cp)
uvicorn app.main:app --reload --port 8000
```

* **With Neo4j Aura:** put the Aura credentials (`NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`) in `backend/.env`, then seed once: `python scripts/seed_data.py` (add `--reset` to refresh the 30-day window). If Aura is unreachable the API returns `503` and reconnects automatically.
* **Without a database:** leave `NEO4J_URI` empty. The same dataset loads in memory; set `DEV_DEFAULT_ACCOUNT_ENABLED=true` for the `1234 / 1234` demo login.
* **Analyst accounts:** set `MONGODB_URI` and `MONGODB_DATABASE` in `backend/.env`. Registration and login use MongoDB; graph, analytics, entities, demo data and GraphRAG remain in Neo4j. If MongoDB is not configured, development falls back to the in-memory account store.
* **AI analyst:** the default is Vertex AI with Google ADC. Run `gcloud auth application-default login`, set `VERTEX_PROJECT_ID`, and optionally `LLM_MODEL` in `backend/.env`; deployment uses a service-account file via `GOOGLE_APPLICATION_CREDENTIALS`. `GET /health` and the dashboard show whether AI is configured. Vertex requires billing and the Vertex AI API to be enabled. Details: `docs/06_GRAPHRAG.md` §5.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies API paths to :8000)
npm run build        # production bundle in dist/
```

### Live coordination demo

1. Sign in and open the dashboard (date range must include today).
2. Optionally pick a platform (X is used when **All** is selected).
3. In **02 Coordination signals**, click **Inject live demo burst**. The API (`POST /demo/coordination`) creates ten new accounts on one datacenter test IP (`192.0.2.x`) posting near-identical `[DEMO]` text under a fresh `#DemoBurst…` hashtag over ~5 minutes, then retweeting the seeding post.
4. The dashboard refreshes and focuses the new cluster in the graph; it appears as a critical row in the cluster table. Use **Ask AI** on that row for the GraphRAG walkthrough.

This is generated demo data, never traffic captured from a real network. Remove injected bursts with `python scripts/seed_data.py --purge-demo`.

### 3. Tests

```bash
cd backend
python -m unittest test_phase2_backend test_phase3_backend test_analytics test_dev_account -v
```
(`test_phase1_api.py` is a smoke script that needs a running server.)

## Deployment

| Part | Target | Config |
|---|---|---|
| API | Render (or any host running `uvicorn app.main:app`) | `render.yaml` — set `NEO4J_*`, `LLM_API_KEY`, `CORS_ORIGINS=<frontend URL>`; `JWT_SECRET` is generated; `ENVIRONMENT=production` refuses unsafe settings. |
| Frontend | Vercel (or Netlify) | `frontend/vercel.json` — root directory `frontend`, env `VITE_API_BASE_URL=<API URL>`. |
| Database | Neo4j Aura Free | Run `python scripts/seed_data.py` once from a machine with the Aura credentials. |

## Environment Variables

Every backend variable is documented in `backend/.env.example`; frontend variables in `frontend/.env.example`. Real values go in the gitignored `backend/.env` / `frontend/.env` — never in `*.env.example`.

## Milestones

- **Phase 1** — COMPLETE ✅ (Frontend scaffolding, UI/UX screens, login/register forms, validation, FastAPI backend, Neo4j layer, JWT auth, seed script)
- **09-10-2026** — Phase 2: Backend CRUD, graph query endpoints, analytics calculation queries
- **10-11-2026** — Phase 3: Final submission, GraphRAG LLM integration, deployment
