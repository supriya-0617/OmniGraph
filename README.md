# OmniGraph

**OSINT & Disinformation Network Analyzer using GraphRAG**

Full Stack Development Project — Course 24CIE554

**Team**
- Swastik R Phadke — 1MS24CI130
- Raghav — 1MS24CI096
- Surpiya J — 1MS24CI129

## What it does

OmniGraph maps simulated social-media activity (users, posts, hashtags, IP addresses) into a graph database and gives an investigator two tools to make sense of it:

1. **An analytics dashboard** — filter the network by threat level, time window, platform, or interaction density; see centrality/frequency metrics as charts and KPIs.
2. **An AI Forensic Analyst (GraphRAG)** — ask natural-language questions about whatever sub-graph is currently filtered; the AI reasons over both the graph structure and the post text to answer things like "where did this narrative originate?" or "which accounts look coordinated?"

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

## Phase 1 Implementation Status: COMPLETE ✅

- **Frontend:** React + Vite + TypeScript, React Router DOM, Cytoscape.js canvas workspace, Recharts analytical placeholders, FilterContext & AuthContext, Login & Register forms with client validation.
- **Backend:** FastAPI, Neo4j database driver connection layer with fallback, bcrypt password hashing, JWT authentication (`/auth/register`, `/auth/login`), CORS configured.
- **Seed Script:** Idempotent Neo4j seed script (`scripts/seed_data.py`) for OSINT graph schema.

## Getting Started

### 1. Setup & Run Backend

```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Seed Database (Optional)

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

See `.env.example` in root and `backend/.env.example`.
Key variables: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `JWT_SECRET`, `LLM_API_KEY`.

## Milestones

- **Phase 1** — COMPLETE ✅ (Frontend scaffolding, UI/UX screens, login/register forms, validation, FastAPI backend, Neo4j layer, JWT auth, seed script)
- **09-10-2026** — Phase 2: Backend CRUD, graph query endpoints, analytics calculation queries
- **10-11-2026** — Phase 3: Final submission, GraphRAG LLM integration, deployment

