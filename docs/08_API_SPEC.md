# 08 — API Specification

Base URL (dev): `http://localhost:8000`. All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <JWT>`.

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
{ "access_token": "jwt...", "token_type": "bearer" }
```

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
Same filter query params as `/graph`.
```json
// response
{
  "total_posts": 142,
  "total_flagged_users": 12,
  "coordinated_clusters": 3,
  "avg_severity": 0.72,
  "posts_over_time": [{ "bucket": "2026-09-01", "count": 20 }, ...],
  "top_hashtags": [{ "tag": "#example", "count": 34 }, ...]
}
```

### `GET /analytics/clusters`
Same filters. Returns the suspected-coordination table rows described in `07_ANALYTICS.md`.

Each row contains `id`, `cluster_ip`, `user_ids`, `user_handles`, `post_ids`, `hashtag`, `time_window_minutes`, and `risk_score`. The score is a deterministic heuristic for sorting, not a probability.

## Demonstration data

### `POST /demo/coordination?platform=X`
Requires a bearer token. Creates ten clearly synthetic accounts and ten repeated posts within 45 seconds, linked to one fictional documentation-range IP and one generated hashtag. The platform can be `X`, `Telegram`, or `Facebook`. Returns `scenario_id`, `shared_ip`, `hashtag`, `platform`, `accounts_created`, `posts_created`, `window_seconds`, `user_ids`, and `post_ids`.

This endpoint does not inspect Wi-Fi, read client IP addresses, or collect network traffic. Its purpose is to safely demonstrate the existing shared-IP/hashtag cluster detector. After it returns, refresh `/graph` and `/analytics/clusters` with the same filters. It works in memory mode or against a connected Neo4j database; a configured but unavailable database returns `503`.

## AI / GraphRAG

### `POST /ai/query`
The frontend's single `FilterContext` is the source for this request and for `/graph` and `/analytics/*`. The UI uses `dateFrom`, `dateTo`, `minSeverity`, and `minDensity`; API payloads use the names below. Omit `from` or `to` when the analyst clears that bound. Do not construct a second AI-only filter state.
```json
// request
{
  "filters": {
    "from": "2026-09-01",
    "to": "2026-09-07",
    "platform": "X",
    "min_severity": 0.5,
    "min_density": 1
  },
  "question": "Where did this narrative originate?"
}
// response
{
  "summary": "...",
  "likely_origin_node_id": "p1",
  "evidence_node_ids": ["u1", "p1"],
  "coordination_flags": [{ "cluster_ip": "ip1", "user_ids": ["u1", "u2"] }],
  "confidence_note": "Based on shared IP and 12-minute posting window."
}
```
`likely_origin_node_id` and each `evidence_node_ids` entry use the same stable IDs returned by `/graph`. The graph may not contain every returned ID because its canvas response is capped or the current filter excludes it; the UI highlights visible nodes and reports missing IDs without changing filters. An empty `evidence_node_ids` array is valid.

## Error shape (consistent across all endpoints)

```json
{ "detail": "human-readable message" }
```
Standard FastAPI `HTTPException` usage; 401 for missing/invalid auth, 404 for missing entities, 422 for validation errors (FastAPI's default via Pydantic models), 500 reserved for genuine server/LLM/DB failures.
