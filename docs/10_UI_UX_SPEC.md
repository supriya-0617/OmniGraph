# 10 — UI/UX Spec

## 1. Screens

| Screen | Purpose |
|---|---|
| Landing page | Explains OmniGraph, previews a clearly labelled simulated network, and links to sign-in/workspace actions. |
| Login / Register | JWT-authenticated analyst entry; registration can log in the new account after success. |
| Dashboard | Protected analyst workspace for shared filters, graph exploration, API-backed analytics, cluster review, and the evidence-grounded AI panel. |

## 2. Landing page and dashboard layout

### Landing page

- Floating glass "pill" header: brand mark, in-page nav (How it works / Signals / AI analyst), live system status (datastore + AI readiness from `/health`), sign-in and a neo-brutalist CTA.
- Hero: brutalist uppercase headline with a serif-italic accent, lede, primary CTA "Open analyst workspace" and secondary "See how it works", plus a **live index** (accounts, posts, active clusters) from `GET /public/stats` with explicit offline/connecting states.
- Hero visual (`components/landing/HeroNetwork.tsx`): a generative Canvas network with an embedded coordinated cluster, radar sweep, cursor repulsion and hover-neighbourhood highlighting. Labelled **Illustrative**; static when `prefers-reduced-motion`.
- Signal ticker; "How it works" (Map / Filter / Measure / Ask); a bento grid explaining the five risk factors with the real weights and the benign-context handling; an AI section showing the response format (labelled illustrative); technology strip; a fully neo-brutalist final CTA.
- Scroll reveal via `IntersectionObserver`, disabled for reduced motion. The landing bundle excludes Cytoscape/Recharts (the dashboard is lazy-loaded).

### Login / Register

Split layout: an editorial panel ("Every network leaves a trace") with live counts on the left, a glass form card with viewfinder corners on the right (the panel hides below 960 px). Password visibility toggle, registration strength meter, session-expired notice, and the `1234 / 1234` demo hint **only** when `/health` reports `dev_account_enabled` (memory mode). Signed-in users visiting `/login` or `/register` are redirected to the dashboard.

### Authenticated dashboard

Header (brand, live datastore/AI status, analyst, sign-out) and the sticky shared filter bar, then four numbered sections:

1. **01 Threat overview** — four KPI cards with previous-period trends, a "Density-scoped" badge when applicable, last-updated time and a manual refresh.
2. **02 Coordination signals** — the ranked, sortable cluster table with **Graph** and **Ask AI** actions.
3. **03 Investigation** — Cytoscape graph (node details, evidence highlighting) beside the GraphRAG analyst on wide screens; stacked below 1280 px.
4. **04 Analytics** — posts over time, platform & severity mix, top hashtags.

Initial loads show skeletons; refreshes dim content; invalid dates, API errors (with Retry) and empty data have explicit states. A failed request clears prior results. The dashboard route redirects to sign-in after the session check completes.

> The filter bar, graph interaction, node details and overall workspace layout belong to the Person-1 workstream and may be reorganised there; the section order above is the integration contract for the AI and analytics features.

## 3. Component list (frontend)

- `<FilterBar />` — edits the single shared `FilterContext`.
- `<GraphCanvas />` — Cytoscape.js graph with node selection, single-node focus (`highlightNodeId`) and evidence-set highlighting (`highlightNodeIds`, `originNodeId`: origin amber ring, evidence violet ring, everything else faded).
- `<KpiCard />` — value, definition, semantic tone and a previous-period trend badge (risk metrics colour increases coral; volume is neutral).
- `<PostsOverTimeChart />`, `<HashtagBarChart />`, `<SignalMixPanel />` — Recharts views built on the shared `charts/ChartCard` (legend, chart/table toggle, tooltip, empty state, refetch dimming).
- `<ClusterTable />` — sortable ranked clusters, risk bar + tier label + per-factor strip, Graph / Ask AI actions.
- `<AiChatPanel />` — GraphRAG investigation assistant (section 7).
- `<HeroNetwork />` — landing-only illustrative canvas animation.
- `<AuthLayout />`, `<LoginPage />`, `<RegisterPage />` — split-layout auth with validation, password toggle and strength meter.
- `<Header />`, `<SystemStatus />`, `<NotificationBanner />`, `<LoadingSpinner />`, `<BrandMark />` — shared chrome.

No component renders mock data. The only illustrative visuals (landing hero network and AI response example) are labelled "Illustrative".

## 4. State management and navigation

`AuthContext` restores the JWT from local storage and **verifies it with `GET /auth/me`**; an expired token, any `401` response or reaching the token's `exp` signs the analyst out with a "session expired" notice. It provides login/register/logout. `/dashboard` is protected and redirects to `/login` when there is no authenticated session. The landing workspace CTA opens the dashboard for an authenticated user and sign-in otherwise.

`FilterContext` remains the single source for the dashboard filter values. Graph and analytics requests use the same filter snapshot and existing query parameters. The API client uses same-origin paths by default: Vite proxies local development API paths, while production must provide a same-origin API/reverse proxy or set `VITE_API_BASE_URL` to the separately deployed API origin. The production backend must allow the frontend origin through CORS.

## 5. Visual direction: "Evidence Room"

A mixture that stays readable around a dense graph:

| Ingredient | Where it shows |
|---|---|
| **Glassmorphism** | Panels are translucent gradients with `backdrop-filter: blur(20px) saturate(140%)`, a 1 px hairline highlight and a soft deep shadow, floating over an ambient aurora (cyan / violet / coral radial light) and a subtle film grain. |
| **Neo-brutalism** | Primary actions are solid fills with a hard *outlined* offset shadow that "presses" on click (`.og-btn-primary`; `--brutal` colour per context: cyan, violet for AI, coral). Focused inputs get a hard offset shadow; the final landing CTA is a full brutalist block. |
| **Brutalism** | Oversized uppercase Space Grotesk headlines, outlined step numerals, mono "evidence stamps" (`.og-stamp`) and kicker labels (`01 / HOW IT WORKS`), square range thumbs. |
| **Minimalism** | One ink-navy base (`#06080e`), hairline borders, generous spacing, colour only where it means something. |

Signature details: viewfinder corner marks (`.og-frame`) on key panels, Instrument Serif italic accents in headlines, live status dots.

**Semantic colour (never decorative):** cyan = primary action / active graph; mint = healthy / neutral; amber = suspicious; coral / red = high severity / flagged / critical; violet = AI and analytical insight. Chart marks use a separately validated palette (`07_ANALYTICS.md` section 4).

**Type:** Space Grotesk (display), Instrument Serif italic (accent), Inter (body and KPI numbers), JetBrains Mono (data, labels, IDs).

**Tokens** live in `frontend/src/index.css` (`--og-*`, plus RGB channels for Tailwind alpha utilities) and `tailwind.config.js` (`surface`, `ink`, `accent.*`). Shared classes kept stable for every workstream: `og-card`, `og-card-header`, `og-section-title`, `og-btn-primary|ghost`, `og-icon-btn`, `og-input`, `og-select`, `og-control-*`, `og-badge-*`, `og-chip`, `og-stamp`, `og-kicker`, `og-frame`, `og-skeleton`, `og-table*`.

**Responsive and accessible:** landing hero/analyst sections stack below 960 px; bento and steps collapse to 2 then 1 column; the investigation grid stacks below 1280 px. Focus rings are visible everywhere (`:focus-visible` cyan outline); status is never colour-only (risk tiers, signal strength and confidence carry text labels); charts provide table views; all motion respects `prefers-reduced-motion`.

## 6. Forms & validation

- Login/Register validate required email, email shape, minimum six-character password, and matching registration confirmation. Submission buttons indicate in-flight work.
- The dashboard rejects a date range where `from` is after `to` before requests are sent and clears results for invalid ranges.
- Backend field validation remains authoritative; API errors are displayed to the user.

## 7. AI investigation panel (`AiChatPanel.tsx`)

* Sits beside the graph on wide screens (`.og-investigation-grid`), stacked below 1280 px; collapsible.
* Header shows provider/model or "Not configured" (from `GET /ai/status`); a hint names the env var to set.
* Scope bar: nodes in filter, current **focus** (set by a cluster's Graph / Ask AI action, removable) and the highlighted-node count (click to clear).
* Thread: questions; structured answers (summary, likely origin with rationale, graded signals with evidence chips, missing evidence, three-step confidence meter, discarded-ID disclosure, context footer with nodes analysed, model and latency); errors with Retry and the rate-limit wait. Persisted per analyst in `sessionStorage`; a divider marks turns asked under different filters; follow-ups send the last four same-filter turns as history.
* Evidence chips highlight nodes; dashed chips mark IDs outside the current view. "Highlight evidence" emphasises origin (amber ring) and evidence (violet ring) and fades everything else; answers auto-highlight on arrival.
* Composer: suggested prompts (cluster-specific when focused), auto-growing textarea, Enter to send / Shift+Enter for a newline, Stop button with a real elapsed timer while waiting.
