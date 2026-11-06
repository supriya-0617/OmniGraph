# 08 — API Specification

Base URL (dev): `http://localhost:8000` (the Vite dev server proxies these paths). Production: `VITE_API_BASE_URL`. All endpoints except `/auth/register`, `/auth/login`, `/health` and `/public/*` require `Authorization: Bearer <JWT>`. Interactive docs: `/docs`.

## Auth

### `POST /auth/register`
```json
// request
{ "email": "a@b.com", "password": "..." }
// response 201
{ "id": "uuid", "email": "a@b.com" }
```

### `POST /auth/login`
```json
// request
{ "email": "a@b.com", "password": "..." }
// response 200
{ "access_token": "jwt...", "token_type": "bearer", "user_email": "a@b.com" }
```

### `GET /auth/me`
Validates the bearer token (used to restore a session on page load). `200 { "id", "email", "expires_at" }`; `401` when missing/expired, and the frontend then signs the analyst out.

## Public

### `GET /health`
`{ status: "online" | "degraded", storage_mode: "memory" | "neo4j" | "neo4j_unavailable", dev_account_enabled, environment, ai: { configured, provider, model }, simulator_enabled }`. Never exposes secrets.

### `GET /public/stats`
Aggregate counts for the landing page, cached 60 s: `{ storage_mode, entities: { User, Post, Hashtag, IPAddress }, coordinated_clusters }`. No handles, text or addresses. `503` when the configured database is down.

## Entities (CRUD — mainly for admin/seed management)

### `GET /entities/users?platform=&flagged=`
Returns paginated `:User` nodes matching filters. Lists use `offset` (default `0`) and `limit` (default `100`, maximum `500`) and return `{ "items": [], "total": 0, "offset": 0, "limit": 100 }`.

### `POST /entities/users`
Create a `:User` node (used by seed script / admin tooling).

### `GET /entities/posts?from=&to=&platform=&min_severity=`
Returns paginated `:Post` nodes matching filters. Date-only `from` and `to` values are interpreted as inclusive UTC calendar days. Pagination is the same as for users.

### `POST /entities/posts`
Create a `:Post` node (and optionally its `POSTED`/`MENTIONS` edges in one call).

Entity item routes are `GET`/`PUT`/`DELETE /entities/{users|posts|hashtags|ips}/{id}`. `PUT` updates only supplied fields. Hashtag and IP collections also support `GET`/`POST`; their paths are `/entities/hashtags` and `/entities/ips`. User creation can link an existing `ip_hash`; post creation can link an existing `author_id` and creates/links hashtags from the supplied `hashtags` array.

Hashtag and IP list responses use the same pagination envelope. Missing entities return `404`; duplicate constrained IDs/tags return `409`. When `NEO4J_URI` is unset, graph CRUD/read routes use an in-memory demo graph; all changes are lost on restart. If Neo4j is configured but unreachable, data routes return `503` rather than silently switching stores.

`GET /health` is public and reports `storage_mode` as `memory`, `neo4j`, or `neo4j_unavailable`.

## Graph (structural read for the canvas)

### `GET /graph`
Query params: `from`, `to`, `platform`, `min_severity`, `min_density`.
`from` and `to` accept date-only values and include the full UTC day. `platform=ALL` is treated as no platform restriction. `min_density` is an integer from `1` to `10`; it is the minimum number of distinct accounts in a shared-IP coordination group. Values above `1` show only posts in qualifying groups.
The canvas response is bounded to the newest 120 matching posts (plus their connected entities and relationships); summary and cluster analytics still use the full filtered dataset.
Node IDs are the stable string values of each entity's `id` property. `props.id` matches the top-level node `id`; edge `source` and `target` values refer to node IDs in the same response. The frontend uses these IDs unchanged for cluster navigation and AI evidence highlighting. Node properties and relationship timestamps are serialized as JSON values.
```json
// response
{
  "nodes": [
    { "id": "u1", "label": "User", "props": { "id": "u1", "handle": "@foo", "flagged": true } },
    { "id": "p1", "label": "Post", "props": { "id": "p1", "text": "...", "severity": 0.8 } }
  ],
  "edges": [
    { "source": "u1", "target": "p1", "type": "POSTED" }
  ]
}
```

## Analytics

### `GET /analytics/summary`
Same filter query params as `/graph`. When `min_density > 1` every aggregate is limited to posts in qualifying clusters (`density_scoped: true`). `trends` is present only when both `from` and `to` are given.
```json
{
  "total_posts": 530, "total_accounts": 181, "total_flagged_users": 30,
  "coordinated_clusters": 11, "high_severity_posts": 64, "avg_severity": 0.29,
  "posts_over_time": [{ "bucket": "2026-11-01", "count": 70, "high_severity": 9 }],
  "top_hashtags": [{ "tag": "#FactCheck", "count": 67 }],
  "platform_breakdown": [{ "platform": "X", "count": 190 }],
  "severity_distribution": [{ "range": "0.0-0.2", "count": 201 }],
  "trends": { "total_posts": { "previous": 471, "delta_pct": 12.5 }, "total_flagged_users": {},
              "coordinated_clusters": {}, "high_severity_posts": {}, "avg_severity": {} },
  "density_scoped": false
}
```

### `GET /analytics/clusters`
Same filters. Rows sorted by `risk_score` descending:
```json
[{
  "id": "net_c01:#AvalonWaterAlert", "ip_id": "net_c01", "cluster_ip": "192.0.2.100", "network_type": "datacenter",
  "hashtag": "#AvalonWaterAlert", "user_ids": ["usr_161"], "user_handles": ["@alert_atlas7496"], "flagged_users": 4,
  "post_ids": ["pst_c01_01"], "platforms": ["X"], "first_seen": "2026-11-05T23:55:00+00:00",
  "last_seen": "2026-11-06T00:26:00+00:00", "time_window_minutes": 30.9, "avg_severity": 0.858,
  "risk_factors": { "size": 1.0, "tempo": 0.485, "severity": 0.858, "infrastructure": 1.0, "duplication": 1.0 },
  "risk_score": 0.861
}]
```
The score is an explainable heuristic (weights in `07_ANALYTICS.md` section 5), not a probability.

## Demonstration data

### `POST /demo/coordination?platform=X`
Requires a bearer token. Creates ten clearly synthetic accounts and ten repeated posts within 45 seconds, linked to one fictional documentation-range IP and one generated hashtag. The platform can be `X`, `Telegram`, or `Facebook`. Returns `scenario_id`, `shared_ip`, `hashtag`, `platform`, `accounts_created`, `posts_created`, `window_seconds`, `user_ids`, and `post_ids`.

This endpoint does not inspect Wi-Fi, read client IP addresses, or collect network traffic. Its purpose is to safely demonstrate the existing shared-IP/hashtag cluster detector. After it returns, refresh `/graph` and `/analytics/clusters` with the same filters. It works in memory mode or against a connected Neo4j database; a configured but unavailable database returns `503`.

## AI / GraphRAG

### `GET /ai/status`
`{ "configured": true, "provider": "gemini", "model": "gemini-3.8-flash", "detail": null }`; `detail` explains what is missing when `configured` is false.

### `POST /ai/query`
Request `{ filters, question, focus_node_ids?, history? }`; response `{ summary, likely_origin_node_id, origin_rationale, coordination_flags[{signal, details, evidence_node_ids, strength}], evidence_node_ids, missing_evidence, confidence, confidence_note, discarded_node_ids, context }`. Full contract, limits and status codes (200 / 422 / 429 / 502 / 503) are in `06_GRAPHRAG.md` section 4.

The frontend's single `FilterContext` is the source for this request and for `/graph` and `/analytics/*` (UI `dateFrom`/`dateTo`/`minSeverity`/`minDensity` are serialized as `from`/`to`/`min_severity`/`min_density`; empty dates are omitted). `likely_origin_node_id` and every evidence ID use the stable IDs returned by `/graph`. Because the canvas is capped at 120 posts, some evidence can be outside the rendered graph; the graph highlight API reports those IDs and the UI says so.

## Demo

### `POST /demo/coordination?platform=X|Telegram|Facebook`
Injects a live coordinated burst for walkthroughs (JWT required): ten new accounts on one datacenter test IP, near-identical `[DEMO]`-prefixed posts under a fresh hashtag over ~5 minutes ending now, plus retweets of the seeding post. Response `201`: `{ scenario_id, shared_ip, hashtag, platform, accounts_created, posts_created, window_seconds, user_ids, post_ids }`. Memory mode writes to the in-memory store; Neo4j writes in one transaction. All IDs start with `demo_`.

## Error shape (consistent across all endpoints)

```json
{ "detail": "human-readable message" }
```
Standard FastAPI `HTTPException` usage; 401 for missing/invalid auth, 404 for missing entities, 422 for validation errors (FastAPI's default via Pydantic models), 429 for the AI rate limit, 502 for unusable model output, 503 when Neo4j or the LLM provider is unavailable (database outages never fall back to memory and never leak driver errors).
