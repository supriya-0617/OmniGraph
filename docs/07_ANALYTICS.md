# 07 — Analytics Dashboard

## 1. Purpose

The dashboard combines KPIs, a ranked coordination table, the investigation workspace (graph + AI analyst) and supporting charts. Every panel reads the single `FilterContext`; there is no separate analytics filter state.

## 2. Filters

| Filter | Query param | Meaning |
|---|---|---|
| Date range | `from`, `to` | Inclusive UTC days applied to post timestamps. An inverted range is rejected client-side (and `422` server-side). Omitted values mean unbounded. |
| Severity | `min_severity` | Minimum post severity 0–1. |
| Platform | `platform` | Exact platform; `ALL` = no restriction. |
| Density | `min_density` | Minimum distinct accounts in a coordination group (shared IP + shared hashtag within 60 minutes), 1–10. |

**Density is applied consistently.** When `min_density > 1`, the graph, the cluster table *and every summary aggregate* are restricted to posts inside qualifying clusters, and the summary returns `density_scoped: true` (shown as a "Density-scoped" badge). This resolves the inconsistency noted in the previous revision.

## 3. KPIs (`GET /analytics/summary`)

| Card | Field | Definition | Trend colour |
|---|---|---|---|
| Posts in filter | `total_posts` (+ `total_accounts`, `high_severity_posts` in the caption) | Posts matching the filters | neutral |
| Flagged accounts | `total_flagged_users` | Distinct flagged users who posted or retweeted a matching post | increase = coral |
| Coordinated clusters | `coordinated_clusters` | Rows returned by `/analytics/clusters` | increase = coral |
| Average severity | `avg_severity` | Mean post severity, shown as % | increase = coral |

**Trends** — when both `from` and `to` are set, the API also computes the same metrics for the immediately preceding window of equal length and returns `trends.<metric> = { previous, delta_pct }` (`delta_pct` is `null` when the previous value is 0). Without a closed date range `trends` is `null`.

## 4. Charts

All chart colours come from `components/dashboard/charts/chartTheme.ts` and were **validated** (lightness band, chroma floor, colour-blind separation, contrast) against the dark panel surface `#0b0f18`. UI accent colours are reserved for chrome. Every chart has a Chart/Table toggle (accessible table view), tooltips, empty states, initial skeletons, and dims instead of flashing on refetch.

| Component | Data | Form |
|---|---|---|
| `PostsOverTimeChart` | `posts_over_time[] {bucket, count, high_severity}` | Area (all posts) + line (severity ≥ 0.7) on **one** y-axis; legend; peak badge |
| `HashtagBarChart` | `top_hashtags[] {tag, count}` (distinct posts, top 10) | Ranked horizontal bars, one colour, value labels |
| `SignalMixPanel` | `platform_breakdown[]`, `severity_distribution[]` (5 bins) | Segmented part-to-whole bar (colour follows the platform, never its rank) + histogram on a single-hue ordinal ramp |
| `ClusterTable` | `/analytics/clusters` | Sortable ranked table (below) |

## 5. Coordination clusters (`GET /analytics/clusters`)

A cluster is an (IP, hashtag) group of accounts where at least one pair posted that hashtag within 60 minutes (Cypher in `04_GRAPH_SCHEMA.md` §5). Each row:

`id, ip_id, cluster_ip, network_type, hashtag, user_ids, user_handles, flagged_users, post_ids, platforms, first_seen, last_seen, time_window_minutes, avg_severity, risk_factors, risk_score`

### Risk score

An explainable weighted sum, each factor normalised to [0, 1]:

| Factor | Weight | Definition |
|---|---|---|
| size | 0.30 | `min(accounts, 8) / 8` |
| severity | 0.25 | mean post severity |
| tempo | 0.20 | `1 − min(window_minutes, 60) / 60` (tighter bursts score higher) |
| infrastructure | 0.15 | datacenter 1.0 · vpn/proxy 0.9 · unknown 0.5 · residential 0.3 · corporate/university 0.1 |
| duplication | 0.10 | share of posts whose word set overlaps ≥ 60 % with another post in the cluster |

Tiers shown with a text label (never colour alone): **Critical** ≥ 0.75, **High** ≥ 0.6, **Elevated** ≥ 0.4, **Low** < 0.4. The score is a ranking heuristic, **not a probability** of malicious intent; per-factor values are shown on hover in the table. On the simulated dataset the six campaigns score 0.57–0.86 and the benign campus-NAT group scores 0.24.

### Table actions

* **Graph** — highlights the cluster's IP, accounts and posts in Cytoscape (others fade), sets it as the AI focus, scrolls to the workspace.
* **Ask AI** — sets the focus and immediately asks the analyst why the cluster is suspicious and who seeded it.

## 6. Loading, empty, error states

Initial load shows skeletons; refreshes dim the previous render. Any failed request clears all panels and shows an error banner with **Retry** (stale values are never presented as current). A `401` anywhere signs the analyst out with a "session expired" notice. Empty responses show explicit zero/"no data" states.

## 7. Tests

`backend/test_analytics.py`: schema validation, date / severity / platform / density filtering, empty results, previous-period trends, ranking order, six campaigns detected, benign NAT ranked last, risk-formula bounds.
