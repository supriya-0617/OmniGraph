# 07 — Analytics Dashboard

## 1. Purpose

Satisfies the rubric's "Data Analytics module/dashboard with filters" requirement, and doubles as the control surface that feeds the GraphRAG chat panel (whatever is filtered here is what the AI reasons about).

## 2. Filters

| Filter | Field | UI control |
|---|---|---|
| Date range | `Post.timestamp` | date range picker |
| Severity / threat level | `Post.severity` | slider or dropdown (low/med/high) |
| Platform | `Post.platform` / `User.platform` | multi-select |
| Interaction density | computed (edges per node in the current window) | slider, "show only clusters above X density" |

All filters combine (AND) and are sent as query params to both `/graph` and `/analytics`.

## 3. Metrics / KPIs

| Metric | Definition | Computed via |
|---|---|---|
| Total posts in filter | count of `:Post` matching filter | Cypher `count()` |
| Total flagged users | count of `:User {flagged:true}` in filter's neighborhood | Cypher |
| Top nodes by centrality | degree (or betweenness, if time allows) centrality within the filtered sub-graph | Cypher `apoc` procedures if APOC is available on Aura tier, else compute in Python/Cytoscape.js client-side for the rendered sub-graph |
| Posts over time | time-bucketed post counts | Cypher grouped by day/hour |
| Top hashtags | count of posts per hashtag in filter | Cypher `count()` grouped by hashtag |
| Suspected coordinated clusters | groups of users sharing IP + tight posting-time window (see query in `04_GRAPH_SCHEMA.md`) | Cypher, surfaced as a table |

> Note on APOC: Neo4j Aura free tier has limited/no APOC procedure support depending on tier — verify what's available before committing to APOC-based centrality; fall back to client-side Cytoscape.js centrality functions (it has built-in degree/betweenness/closeness) if needed.

## 4. Chart types (Recharts)

- **KPI cards**: total posts, total flagged users, total coordinated clusters detected (simple numbers, updates on filter change).
- **Line/area chart**: posts-over-time within the filtered window.
- **Bar chart**: top hashtags by post count.
- **Table**: top suspected-coordination clusters with a "view in graph" action that jumps to that cluster on the Cytoscape.js canvas.

## 5. Interaction with the AI panel

The dashboard's current filter state is the single source of truth passed to `/ai/query` — the analyst doesn't re-describe the filter in their question; they just ask "why is this cluster flagged?" and the backend already knows what "this cluster" refers to from the active filters. This is the concrete way OmniGraph satisfies the "AI + Analytics demonstration" rubric item.
