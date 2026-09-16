# 08 — API Specification

Base URL (dev): `http://localhost:8000`. All endpoints except `/auth/*` require `Authorization: Bearer <JWT>`.

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
Returns paginated `:User` nodes matching filters.

### `POST /entities/users`
Create a `:User` node (used by seed script / admin tooling).

### `GET /entities/posts?from=&to=&platform=&min_severity=`
Returns paginated `:Post` nodes matching filters.

### `POST /entities/posts`
Create a `:Post` node (and optionally its `POSTED`/`MENTIONS` edges in one call).

*(Analogous `GET`/`POST`/`PUT`/`DELETE` for hashtags and IP addresses — full CRUD isn't the interesting part of this project; keep these thin.)*

## Graph (structural read for the canvas)

### `GET /graph`
Query params: `from`, `to`, `platform`, `min_severity`, `min_density`.
```json
// response
{
  "nodes": [
    { "id": "u1", "label": "User", "props": { "handle": "@foo", "flagged": true } },
    { "id": "p1", "label": "Post", "props": { "text": "...", "severity": 0.8 } }
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
  "posts_over_time": [{ "bucket": "2026-09-01", "count": 20 }, ...],
  "top_hashtags": [{ "tag": "#example", "count": 34 }, ...]
}
```

### `GET /analytics/clusters`
Same filters. Returns the suspected-coordination table rows described in `07_ANALYTICS.md`.

## AI / GraphRAG

### `POST /ai/query`
```json
// request
{
  "filters": { "from": "...", "to": "...", "platform": "X", "min_severity": 0.5 },
  "question": "Where did this narrative originate?"
}
// response
{
  "summary": "...",
  "likely_origin_node_id": "p1",
  "coordination_flags": [{ "cluster_ip": "ip1", "user_ids": ["u1", "u2"] }],
  "confidence_note": "Based on shared IP and 12-minute posting window."
}
```

## Error shape (consistent across all endpoints)

```json
{ "detail": "human-readable message" }
```
Standard FastAPI `HTTPException` usage; 401 for missing/invalid auth, 404 for missing entities, 422 for validation errors (FastAPI's default via Pydantic models), 500 reserved for genuine server/LLM/DB failures.
