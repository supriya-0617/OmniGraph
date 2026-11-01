# 10 — UI/UX Spec

## 1. Screens

| Screen | Purpose |
|---|---|
| Landing page | Explains OmniGraph, previews a clearly labelled simulated network, and links to sign-in/workspace actions. |
| Login / Register | JWT-authenticated analyst entry; registration can log in the new account after success. |
| Dashboard | Protected analyst workspace for shared filters, graph exploration, API-backed analytics, cluster review, and the explicitly planned (inactive) AI panel. |

## 2. Landing page and dashboard layout

### Landing page

- Header: product mark, in-page Platform / Workflow / Roadmap navigation, sign-in link, and workspace CTA.
- Hero: OSINT network-analysis positioning, concise explanation, workspace CTA, and a secondary platform anchor.
- Graph preview: reuses `GraphCanvas` with its built-in sample dataset; it is explicitly labelled as sample/simulated data and is not fetched from the authenticated API.
- Platform and workflow sections explain connected entity exploration, date/platform/severity/density filtering, analytics, and shared-IP coordination review.
- AI investigation is labelled planned. The landing page does not claim that GraphRAG is available.
- Footer provides a registration link.

### Authenticated dashboard

The actual dashboard is a responsive, vertically stacked workspace:

1. Header and sticky shared filter bar (date range, platform, minimum severity, minimum density).
2. Threat Overview KPI cards.
3. Daily posts-over-time area chart.
4. Top hashtags and coordinated-cluster table in a responsive two-column section on wide screens.
5. Network graph with node details and cluster-to-node highlighting.
6. Collapsible GraphRAG panel, currently a non-functional planned-feature message.

Initial loading, filter-update, invalid-date, API error, and empty-data states are shown in the relevant dashboard sections. A failed request clears prior results. The dashboard route redirects unauthenticated users to sign-in after the auth session restore completes.

## 3. Component list (frontend)

- `<FilterBar />` — edits the single shared `FilterContext`.
- `<GraphCanvas />` — Cytoscape.js graph; supports node selection and the existing node-ID highlight prop. The landing preview uses its sample graph; the dashboard passes API graph data.
- `<KpiCard />` — API-backed total posts, flagged users, coordinated clusters, and average severity.
- `<PostsOverTimePlaceholder />` — legacy component filename; actual responsive Recharts area chart with daily date/count data, axes, tooltip, and empty state.
- `<HashtagChartPlaceholder />` — legacy component filename; actual responsive Recharts horizontal bar chart with API counts, readable long-label behavior, tooltip, and empty state.
- `<ClusterTablePlaceholder />` — legacy component filename; actual ranked API cluster table, heuristic note, optional-value handling, and existing “View in Graph” action.
- `<AiChatPanel />` — collapsible planned-feature notice only. It has no question input, API call, response rendering, or evidence highlighting.
- `<LoginPage />`, `<RegisterPage />` — separate auth forms with client-side validation and submission feedback.

The analytics filenames retain `Placeholder` for compatibility; they are not mock-data components. They render real API response data. The landing graph preview is the exception and is clearly labelled simulated.

## 4. State management and navigation

`AuthContext` restores JWT/user state from local storage and provides login/logout. `/dashboard` is protected and redirects to `/login` when there is no authenticated session. The landing workspace CTA opens the dashboard for an authenticated user and sign-in otherwise.

`FilterContext` remains the single source for the dashboard filter values. Graph and analytics requests use the same filter snapshot and existing query parameters. The API client uses same-origin paths by default: Vite proxies local development API paths, while production must provide a same-origin API/reverse proxy or set `VITE_API_BASE_URL` to the separately deployed API origin. The production backend must allow the frontend origin through CORS.

## 5. Visual direction and responsive behavior

- Dark intelligence-operations palette with near-black/charcoal surfaces, fine borders, muted typography, and restrained mint/cyan, amber, coral/red, and violet accents.
- Shared card, button, badge, table, and typography treatments connect landing and dashboard presentation.
- Keyboard focus is visible on landing-page links and buttons. Reduced-motion preferences disable the landing preview entrance animation.
- Landing content uses a wide two-column hero on desktop, stacked content and cards on small screens, and keeps anchor navigation available on mobile.
- Dashboard charts use Recharts `ResponsiveContainer`. The cluster table scrolls inside its own horizontal wrapper on narrow screens so the page itself does not need to overflow.
- Graph canvas remains the main investigative visualization; analytics support it without adding a second graph engine.

## 6. Forms & validation

- Login/Register validate required email, email shape, minimum six-character password, and matching registration confirmation. Submission buttons indicate in-flight work.
- The dashboard rejects a date range where `from` is after `to` before requests are sent and clears results for invalid ranges.
- Backend field validation remains authoritative; API errors are displayed to the user.

## 7. AI interaction status

The AI panel and landing copy explicitly describe GraphRAG as planned and inactive. There is no registered backend `/ai/query` route, no live model call, and no UI submission/evidence flow. The backend adapter currently contains canned stub output and is not wired into the application; it must not be treated as generated analysis. AI interaction and graph evidence highlighting remain unimplemented pending a real backend contract.
