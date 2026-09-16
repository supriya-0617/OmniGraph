# 09 — User Flows

## 1. Register / Login

1. Analyst opens the app, unauthenticated → redirected to Login.
2. New user → "Register" tab, submits email/password → account created → auto-redirect to Login.
3. Login submits credentials → JWT stored (memory or localStorage) → redirected to Dashboard.

## 2. Explore the network (core flow)

1. Dashboard loads with a default filter (e.g., last 7 days, all platforms) → `/graph` and `/analytics/summary` called.
2. Cytoscape.js canvas renders nodes/edges; Recharts panels render KPIs/charts alongside.
3. Analyst adjusts a filter (e.g., narrows date range, raises severity threshold) → both calls re-fire → canvas and charts update together.
4. Analyst clicks a node on the canvas → side panel shows that node's properties and direct neighbors.

## 3. Investigate a suspected cluster

1. From the "Suspected coordinated clusters" table (`/analytics/clusters`), analyst clicks "View in graph" on a row.
2. Filter state updates to isolate that cluster's IP/time window; canvas re-centers on it.
3. Analyst visually inspects the shared-IP / tight-timing pattern.

## 4. Ask the AI Forensic Analyst

1. With a filter active (e.g., the cluster from flow 3), analyst opens the chat panel and types: "Is this a coordinated botnet, and where did the narrative start?"
2. Frontend sends `{filters, question}` to `/ai/query`.
3. Backend extracts the matching sub-graph, builds the GraphRAG prompt, calls the LLM.
4. Response renders in the chat panel: summary text, a highlighted "likely origin" node on the canvas (frontend uses `likely_origin_node_id` to focus/highlight that node), and any coordination flags as a short list.
5. Analyst can ask a follow-up question; each question is independent (re-extracts the sub-graph fresh from current filters) unless the team decides to add conversational memory as a stretch goal.

## 5. Empty / edge cases

- Filter returns no data → dashboard shows an empty state, AI panel is disabled with a "no data in this filter" message (no LLM call made — see `06_GRAPHRAG.md` §5).
- LLM call fails/times out → chat panel shows a retry option, doesn't crash the dashboard.
