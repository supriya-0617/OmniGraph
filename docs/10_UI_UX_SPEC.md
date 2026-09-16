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
├───────────────┬───────────────────────────────────────────┤
│               │  Filters bar (date range · severity ·      │
│               │  platform · density)                        │
│  Left rail:   ├───────────────────────────────────────────┤
│  - KPI cards  │                                               │
│  - Top        │        Cytoscape.js graph canvas             │
│    hashtags   │        (main focus, largest area)            │
│    chart      │                                               │
│  - Clusters   │                                               │
│    table      │                                               │
├───────────────┴───────────────────────────────────────────┤
│  AI Forensic Analyst chat panel (collapsible drawer,        │
│  bottom or right side)                                       │
└───────────────────────────────────────────────────────────┘
```

- **Filters bar**: always visible, sticky — this is the control surface for the whole screen (canvas + charts + AI all read from it).
- **Canvas**: largest area since it's the primary investigative surface; clicking a node opens a small side-panel with its properties.
- **Left rail**: secondary analytics (KPIs, hashtag chart, clusters table) — supports the canvas rather than competing with it for attention.
- **AI chat panel**: collapsible so it doesn't dominate the screen when not in use, but easy to reopen; shows conversation history for the current session.

## 3. Component list (frontend)

- `<FilterBar />` — controls, emits filter-state changes up to a shared context/store.
- `<GraphCanvas />` — wraps Cytoscape.js, takes nodes/edges as props, handles click/hover, exposes a `focusNode(id)` method (used when the AI returns a `likely_origin_node_id`).
- `<KpiCard />` — small reusable stat card.
- `<HashtagBarChart />`, `<PostsOverTimeChart />` — Recharts wrappers.
- `<ClusterTable />` — sortable table, "View in graph" action per row.
- `<AiChatPanel />` — message list + input, calls `/ai/query`, renders structured responses (summary, flags, origin highlight).
- `<AuthForm />` — shared login/register form.

## 4. State management

Given React + Vite (no Next.js/Redux mandated), use React Context + hooks for the shared filter state (simplest option that satisfies "Forms working / Navigation working" Phase-1 requirements without extra dependencies). Reach for a library like Zustand only if Context becomes unwieldy.

## 5. Visual direction

Dark, "security ops" aesthetic fits the OSINT/threat-intel subject matter well: dark background, high-contrast accent color for flagged/high-severity elements (e.g., red/orange), muted colors for normal nodes. Keep the graph canvas readable — don't over-decorate node styling; let color/size encode severity and centrality (larger/redder = more central/severe), not decoration for its own sake.

## 6. Forms & validation (Phase-1 requirement)

- Login/Register: email format validation, password minimum length, inline error messages, disabled submit while request is in flight.
- Filter bar isn't a traditional "form" but should validate range sanity (e.g., date "from" ≤ "to") client-side before firing requests.
