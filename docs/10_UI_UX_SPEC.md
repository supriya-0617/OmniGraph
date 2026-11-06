# 10 — UI/UX Spec

## 1. Screens

| Screen | Purpose |
|---|---|
| Login / Register | Auth entry point |
| Dashboard (main screen) | Everything below lives here as panels, not separate pages — keeps the filter-drives-everything interaction model simple |

## 2. Dashboard layout

```
┌───────────────────────────────────────────────────────────┐
│  Top bar: OmniGraph logo · logged-in user · logout          │
├───────────────────────────────────────────────────────────┤
│  Filters bar (date range · severity · platform · density) │
├───────────────────────────────┬───────────────────────────┤
│                               │  Suspected clusters       │
│  Cytoscape.js investigation   │  (View in graph)           │
│  graph (main focus)            │                           │
│                               │                           │
├───────────────────────────────┴───────────────────────────┤
│  KPIs · posts over time · top hashtags                    │
├───────────────────────────────────────────────────────────┤
│  AI Forensic Analyst chat panel (collapsible drawer,        │
│  bottom or right side)                                       │
└───────────────────────────────────────────────────────────┘
```

- **Filters bar**: sticky — this is the control surface for the whole screen (canvas + charts + AI all read from it). On narrow screens the controls collapse behind an "Edit filters" toggle.
- **Canvas**: largest area since it's the primary investigative surface; clicking a node opens a details panel. Zoom, fit, layout reset, and focus controls remain available on small and large screens.
- **Cluster table**: secondary to the graph; "View in Graph" focuses all visible users and posts from the selected cluster and reports IDs absent from the current bounded graph.
- **Analytics**: KPIs and charts are placed below the primary graph workspace and consume the same filter context.
- **AI chat panel**: collapsible so it doesn't dominate the screen when not in use, but easy to reopen; shows conversation history for the current session.

## 3. Component list (frontend)

- `<FilterBar />` — controls the shared `FilterContext` state (`dateFrom`, `dateTo`, `platform`, `minSeverity`, `minDensity`), displays active filters, validates date ranges, and resets to defaults.
- `<GraphCanvas />` — wraps Cytoscape.js and consumes `/graph` nodes/edges without applying a second client-side filter. Node `id`, edge `source`, and edge `target` are the stable entity IDs. It exposes `focusNodes(ids)`, `highlightNodes(evidenceIds, originId?)`, and `clearHighlights()`; it returns IDs missing from the current bounded graph.
- `<KpiCard />` — small reusable stat card.
- `<HashtagBarChart />`, `<PostsOverTimeChart />` — Recharts wrappers.
- `<ClusterTable />` — lists filtered clusters; "View in graph" passes `user_ids` and `post_ids` to the graph focus action.
- `<AiChatPanel />` — integration surface receives the shared filters and evidence-highlighting callback. When `/ai/query` is connected, it renders structured responses (`summary`, `coordination_flags`, `confidence_note`) and passes `likely_origin_node_id` plus `evidence_node_ids` to the graph highlighting API.
- `<AuthForm />` — shared login/register form.

## 4. State management

Given React + Vite (no Next.js/Redux mandated), use React Context + hooks for the shared filter state (simplest option that satisfies "Forms working / Navigation working" Phase-1 requirements without extra dependencies). Reach for a library like Zustand only if Context becomes unwieldy.

The client serializes that state for APIs as `{ from, to, platform, min_severity, min_density }`. Every dashboard request uses the same snapshot. Invalid date ranges block refreshes and are shown inline. Loading, API error, empty results, and selected-node details are distinct states; a failed refresh clears stale graph/analytics data so results from different filter snapshots are not shown together.

## 5. Visual direction

Dark, "security ops" aesthetic fits the OSINT/threat-intel subject matter well: `#0b0f19` primary background, `#111827` raised surface, cyan interaction accent, and rose high-severity emphasis. Graph entity colors are cyan (user), violet (post), amber (hashtag), and emerald (IP address); flagged/high-severity nodes use rose. Yellow borders indicate AI evidence, and cyan borders indicate a focused cluster. Keep the graph canvas readable — use color/size for meaning, not decoration.

## 6. Forms & validation (Phase-1 requirement)

- Login/Register: email format validation, password minimum length, inline error messages, disabled submit while request is in flight.
- Filter bar isn't a traditional "form" but should validate range sanity (e.g., date "from" ≤ "to") client-side before firing requests.
