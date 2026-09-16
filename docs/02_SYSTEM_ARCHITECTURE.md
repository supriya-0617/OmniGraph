# 02 — System Architecture

## 1. High-level diagram (textual)

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   React + Vite frontend │  REST  │        FastAPI backend        │
│                          │◄──────►│                                │
│  - Graph canvas          │ JSON   │  /auth        (register/login)│
│    (Cytoscape.js)        │        │  /entities    (CRUD)          │
│  - Filters panel         │        │  /analytics   (metrics/KPIs)  │
│  - Analytics dashboard   │        │  /graph       (filtered read) │
│    (Recharts)            │        │  /ai/query    (GraphRAG)      │
│  - AI chat panel         │        │                                │
└─────────────────────────┘        └───────────────┬────────────────┘
                                                      │ Bolt protocol
                                                      ▼
                                          ┌────────────────────────┐
                                          │   Neo4j Aura (cloud)    │
                                          │  Users/Posts/Hashtags/  │
                                          │  IPs + interaction      │
                                          │  edges                  │
                                          └────────────────────────┘
                                                      ▲
                                                      │ sub-graph extract
                                          ┌────────────────────────┐
                                          │  LangChain/LlamaIndex   │
                                          │  GraphRAG layer          │
                                          │      │                   │
                                          │      ▼                   │
                                          │   LLM (Gemini / TBD)     │
                                          └────────────────────────┘
```

## 2. Components

### Frontend (React + Vite)
- **Graph view**: Cytoscape.js canvas, receives a filtered node/edge list from `/graph` and renders it; clicking a node can highlight neighbors.
- **Filters panel**: date range, severity, platform, interaction-density threshold — controls what's sent as query params to `/graph` and `/analytics`.
- **Analytics dashboard**: Recharts components consuming `/analytics` responses (KPIs, time series, top-node tables).
- **AI chat panel**: sends the *current filter state* + the analyst's question to `/ai/query`; renders the returned forensic summary.
- **Auth pages**: login/register forms, JWT stored client-side, attached to all subsequent requests.

### Backend (FastAPI)
- **`/auth`**: register, login, returns JWT.
- **`/entities`**: CRUD for Users, Posts, Hashtags, IPAddresses — mainly used by the data-pipeline/seed script, exposed for admin/demo purposes.
- **`/graph`**: given filter params, runs a Cypher query, returns nodes+edges in a frontend-friendly JSON shape.
- **`/analytics`**: given the same filter params, computes/returns centrality, frequency, and cluster metrics.
- **`/ai/query`**: given filter params + a natural-language question, extracts the matching sub-graph, builds a GraphRAG prompt, calls the LLM adapter, returns the answer.

### Database (Neo4j Aura)
- Single graph holding all entities and interactions. See `04_GRAPH_SCHEMA.md`.
- Cypher does the heavy lifting for both `/graph` (structural read) and the sub-graph extraction step feeding GraphRAG.

### AI / GraphRAG layer
- Not a separate service — a Python module inside the backend (`backend/app/ai/`).
- Responsible for: (1) turning a filter into a Cypher sub-graph query, (2) serializing that sub-graph + associated post text into a prompt, (3) calling the LLM through one adapter function, (4) returning a structured response.
- See `06_GRAPHRAG.md` for the detailed flow.

## 3. Data flow (a single "ask the AI" interaction)

1. Analyst sets filters on the dashboard → frontend calls `/graph` and `/analytics` to render the view.
2. Analyst types a question in the AI panel → frontend calls `/ai/query` with `{filters, question}`.
3. Backend re-runs the filter as a Cypher query to get the exact sub-graph in scope.
4. Backend serializes sub-graph (structure + post text) into a GraphRAG prompt.
5. Backend calls the LLM adapter with that prompt.
6. LLM response is returned to the frontend and rendered in the chat panel.

## 4. Deployment shape (target)

- Frontend: static build, deployable to Vercel/Netlify.
- Backend: FastAPI app, deployable to Render/Railway (or similar free-tier host).
- Database: Neo4j Aura free tier (already cloud-hosted, no separate deployment step).
- Secrets (`NEO4J_URI`, `NEO4J_PASSWORD`, `LLM_API_KEY`, `JWT_SECRET`) via environment variables on each host, never committed.
