# 11 — Implementation Plan

## Milestones (as given by the course)

| Date | Milestone | Requirements |
|---|---|---|
| *(not specified — confirm with instructor)* | **Phase 1: Frontend + basic backend** | Frontend: all pages designed, navigation working, forms working, validation implemented. Backend: project set up, database connected, at least one module (e.g., login/register) integrated. |
| **09-10-2026** | **Phase 2: Complete backend** | All APIs completed, CRUD working, authentication & authorization, database fully connected, frontend integrated with backend. |
| **10-11-2026** | **Final submission** | Working project, source code, documentation draft, deployment (if required), AI/Chatbot integration, data analytics module, and a demonstration of AI + analytics working together. |

⚠️ Only two dates were given in the course brief (09-10-2026 and 10-11-2026). Confirm the Phase-1 deadline directly rather than assuming — it isn't stated in the material provided.

## Suggested internal breakdown

### Phase 1 target (frontend + backend skeleton)
- [ ] Repo scaffolding: `/frontend` (Vite + React), `/backend` (FastAPI), this `/docs` folder committed first.
- [ ] Frontend: page shells for Login/Register + Dashboard layout (filter bar, empty canvas area, empty chart placeholders, chat panel shell).
- [ ] Frontend: client-side routing (even if just Login ↔ Dashboard), form validation on Login/Register.
- [ ] Backend: FastAPI project set up, Neo4j Aura instance created, connection tested.
- [ ] Backend: `/auth/register` and `/auth/login` working end-to-end, wired to the frontend forms.
- [ ] Seed script v1 (`05_DATA_PIPELINE.md`) producing a small sample dataset in Neo4j.

### Phase 2 target (09-10-2026 — full backend)
- [x] `/entities` CRUD complete for all node types.
- [x] `/graph` returns filtered nodes/edges; Cytoscape.js renders API data.
- [x] `/analytics/summary` and `/analytics/clusters` implemented; Recharts panels use API results.
- [x] JWT auth enforced on entity, graph, and analytics routes.
- [x] Deterministic in-memory development dataset includes 200 users, 2,000 posts, and deliberate coordination scenarios.
- [x] Frontend dashboard is integrated with graph and analytics APIs; filters refresh all panels.
- [x] Configure and verify persistent Neo4j connectivity and Neo4j-backed CRUD/analytics.

**Status:** Phase 2 is complete for the verified Aura-backed deployment path. Auth fails closed when Neo4j is configured but unavailable, Neo4j-backed entity writes use transactions, Neo4j temporal values are serialized safely, and live Aura verification covers health, authentication, entity reads, graph reads, and analytics. The deterministic 200-user/2,000-post dataset remains the database-free development fixture; the Aura seed currently contains the smaller demo dataset. The GraphRAG panel is intentionally deferred to Phase 3.

### Phase 3 target (leading into 10-11-2026 — AI + analytics + polish)
- [ ] Finalize LLM provider decision (currently leaning Gemini) and implement `llm_client.py` adapter.
- [ ] `/ai/query` endpoint: sub-graph extraction, prompt construction, LLM call, structured response.
- [ ] `<AiChatPanel />` wired to `/ai/query`, including node-highlight-on-response behavior.
- [ ] End-to-end rehearsal: filter → dashboard updates → ask AI → AI response references the filtered cluster (this is the core demo moment for the rubric).
- [ ] Deployment: frontend to Vercel/Netlify, backend to Render/Railway, verify env vars/secrets on both.
- [ ] Documentation pass: fill in any `[stated]`/TBD gaps left in these docs, write the final documentation draft for submission.

## Suggested team split (adjust as needed)

Three team members, three natural tracks:
- **Frontend & UI/UX** — pages, canvas integration, charts, forms/validation.
- **Backend & data** — FastAPI, Neo4j schema/queries, seed pipeline, auth, CRUD.
- **AI/GraphRAG & analytics logic** — sub-graph extraction, prompt design, LLM adapter, centrality/cluster-detection queries.

Expect overlap near Phase 3 since the AI and analytics tracks both depend on the graph queries being solid — plan a joint session there rather than working in isolation.

## Risks to watch

- **Aura free-tier limits** (APOC availability, connection limits, storage cap) — verify early, don't discover this during Phase 2.
- **LLM provider not finalized** — keep the adapter isolated (per `AGENTS.md`) so this doesn't block Phase 3 start.
- **Scope creep on "live-streamed" simulation** — treat as optional stretch, not core (see `05_DATA_PIPELINE.md` §4).
