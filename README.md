# OmniGraph

**OSINT & Disinformation Network Analyzer**

Full Stack Development Project — Course 24CIE554

**Team**
- Swastik R Phadke — 1MS24CI130
- Raghav — 1MS24CI096
- Surpiya J — 1MS24CI129

## What it does

OmniGraph maps simulated social-media activity (users, posts, hashtags, IP addresses) into an explorable graph and gives an investigator a filtered graph and analytics dashboard. A GraphRAG forensic analyst is planned for a later phase:

- **Current:** filter the network by severity, time window, platform, or coordination density; inspect accounts, posts, hashtags, and suspected clusters.
- **Planned:** ask natural-language questions about the currently filtered sub-graph using an AI Forensic Analyst.

## Tech stack

- **Frontend:** React + Vite, Cytoscape.js (graph rendering), Recharts (charts)
- **Backend:** Python, FastAPI
- **Database:** Neo4j (Aura, cloud-hosted)
- **AI:** LangChain/LlamaIndex + an LLM (see `docs/03_TECH_STACK.md` for current status)

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
- **Phase 2:** entity APIs, JWT-protected graph/analytics APIs, deterministic 200-user/2,000-post in-memory fixture, and dashboard API integration complete for database-free development.
- **Still deferred:** persistent Neo4j connection and Neo4j-backed verification; GraphRAG is Phase 3.

## Getting Started

### 1. Setup & Run Backend

Neo4j is optional for local development. With `NEO4J_URI` unset, the backend starts with an in-memory demo graph and supports auth, entity CRUD, graph reads, and analytics. Data created in this mode is lost when the backend stops.

```bash
cd backend
python3 -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Seed Database (Optional)

This step is only needed when Neo4j is configured; the in-memory demo data loads automatically.

```bash
cd backend
python scripts/seed_data.py
```

### 3. Setup & Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to open the analyst workstation.

## Environment Variables

See `.env.example` in root and `backend/.env.example`. Neo4j credentials (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`) are optional for the current in-memory development mode. `JWT_SECRET` can be set for a stable local signing key. `LLM_API_KEY` is not needed until the AI integration phase.

### Backend Tests

```bash
cd backend
source .venv/bin/activate
python -m unittest discover -s . -p 'test*.py' -v
```

## Milestones

- **Phase 1** — COMPLETE ✅ (Frontend scaffolding, UI/UX screens, login/register forms, validation, FastAPI backend, Neo4j layer, JWT auth, seed script)
- **09-10-2026** — Phase 2: Backend CRUD, graph query endpoints, analytics calculation queries
- **10-11-2026** — Phase 3: Final submission, GraphRAG LLM integration, deployment

