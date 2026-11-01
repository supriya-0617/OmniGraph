# 07 — Analytics Dashboard

## 1. Purpose

The authenticated dashboard combines a filtered graph with API-backed KPIs, daily post activity, hashtag counts, and suspected coordinated-cluster results. The dashboard reads one shared `FilterContext`; it does not maintain a separate analytics filter state.

The GraphRAG panel is currently a non-functional planned feature. No `/ai/query` route is registered, and the dashboard does not send filters or questions to an AI service.

## 2. Filters

| Filter | API query parameter | Current meaning |
|---|---|---|
| Date range | `from`, `to` | Inclusive UTC calendar dates applied to post timestamps. The dashboard rejects an inverted range before making requests. |
| Severity / threat level | `min_severity` | Minimum post severity, from 0 to 1. |
| Platform | `platform` | Exact post platform; `ALL` is normalized by the backend to no platform restriction. |
| Interaction density | `min_density` | Minimum distinct users in a coordination group sharing an IP and hashtag within a one-hour window; integer range 1–10. This is not edges per node. |

The API service sends the same filter snapshot, parameter names, and formats to `GET /graph`, `GET /analytics/summary`, and `GET /analytics/clusters`. Date, platform, and severity predicates combine with AND semantics in backend post matching.

**Known density inconsistency (unresolved):** The graph route restricts posts to qualifying groups when `min_density > 1`; the clusters route returns only qualifying groups; the summary route applies density to `coordinated_clusters` but calculates its other aggregates from all posts matching date, platform, and severity. At elevated density thresholds, the graph, clusters, summary KPIs, and charts therefore do not all describe the same population. This needs a backend-owner decision and correction; it is not fixed in the frontend.

The graph is also bounded to at most 120 matching posts. Analytics summary queries use the full matching post set (subject to the density inconsistency above).

## 3. Metrics / KPIs

`GET /analytics/summary` supplies the dashboard values directly:

| Dashboard metric | API field | Meaning |
|---|---|---|
| Total Posts In Filter | `total_posts` | Count of posts matching date, platform, and severity filters. |
| Flagged Users | `total_flagged_users` | Distinct flagged users connected to matching posts. |
| Coordinated Clusters | `coordinated_clusters` | Number of coordination clusters returned for the requested `min_density`. |
| Avg Threat Severity | `avg_severity` | Average post severity, shown as a percentage. This is an additional dashboard KPI. |

Zero counts and zero average severity are shown as zero. Centrality metrics are not currently provided by the analytics API or displayed as dashboard KPIs.

## 4. Charts and cluster table

### Posts over time

- Source: `posts_over_time[]` entries with `bucket` (ISO date string, daily buckets) and `count` (post count).
- Rendered as a responsive Recharts area chart with date and post-count axes and a date/count tooltip.
- Invalid bucket strings are displayed as supplied rather than converted into a misleading date.
- An empty array displays a no-posts message; API failure displays an unavailable state.

### Top hashtags

- Source: `top_hashtags[]` entries with `tag` and `count` (distinct posts mentioning the tag).
- Rendered as a responsive horizontal Recharts bar chart; the UI sorts a copy by count and does not change the API data.
- The axis identifies post counts. Long ticks are shortened for layout, while the tooltip and summary chips retain the complete tag.
- An empty array displays a no-activity message; API failure displays an unavailable state.

### Coordinated clusters

`GET /analytics/clusters` returns rows containing `id`, `cluster_ip`, `user_ids`, `user_handles`, `post_ids`, `hashtag`, `time_window_minutes`, and `risk_score`. The table displays:

- Cluster identifier and shared IP address.
- User count derived from `user_ids.length`, plus handles when present.
- Associated hashtag.
- Time window in minutes and the number/list of post IDs.
- Backend-provided risk score, sorted descending; the frontend does not recalculate it.
- A “View in Graph” action, which highlights the first listed user ID or, if absent, the first post ID when that node exists in the graph.

The current response does not include per-cluster post severity, timestamps, or post text; the table does not invent these values. Missing optional fields render safely as unavailable. On narrow screens, the table scrolls within its own container.

The backend risk score is:

`min(1, 0.25 + 0.1 * min(user_count, 5) + 0.25 * average_post_severity)`

This bounded score is a ranking heuristic, **not a calibrated probability**. The UI displays the returned decimal score and labels this limitation.

### Loading, empty, and error states

Initial fetches show section-level loading indicators. Filter refreshes show updating indicators. A successful response replaces prior results; an empty response shows explicit zero/no-results states. Invalid dates skip requests and clear results. If any of the graph, summary, or cluster requests fails, the dashboard clears its prior results and displays an error rather than presenting stale values as current. Outdated or aborted requests cannot replace newer results.

## 5. Interaction with the AI panel

The dashboard currently renders a collapsible GraphRAG placeholder that explicitly says AI analysis is planned and inactive. No AI endpoint/router is present in the backend, and the frontend does not submit a question, pass filters to an AI service, render evidence, or highlight AI-selected evidence. The existing `llm_client.py` is an adapter stub with canned static output; it is not a live model integration and must not be presented as one.

To complete this workflow, the backend owner must implement and register an authenticated `/ai/query` contract that accepts the current filter state and question, performs real graph extraction/model inference, and returns validated evidence IDs. Frontend integration and evidence highlighting can follow once that contract exists.
