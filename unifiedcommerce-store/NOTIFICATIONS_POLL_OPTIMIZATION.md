# Notifications poll optimization (DB connection pool)

## Problem

The Medusa Admin dashboard polls `GET /admin/notifications` every **60 seconds** (e.g. to show the unread bell). When many users or tabs are open, this can exhaust the database connection pool because each request runs a query and holds a connection until the response is sent.

## Solution

A **custom** `GET /admin/notifications` route in this project:

- **Response cache (45s default)**  
  The list response is cached in memory for 45 seconds per unique query (limit, offset, fields, filters). So the dashboard’s 60s poll often gets a cached response and does **not** hit the database every time. Connections are used only when the cache misses.

- **Single short-lived query**  
  On cache miss, the route uses `refetchEntities` once and returns immediately, so the DB connection is released as soon as the request completes.

## Configuration

- **`NOTIFICATIONS_CACHE_TTL_MS`** (optional, env)  
  Cache TTL in milliseconds. Default: `45000` (45 seconds).  
  Set to `0` to disable caching and always hit the DB (same behavior as before, minus the custom route).

## Files

- `src/api/admin/notifications/route.ts` – custom GET handler with cache and same response shape as the default route.

## Result

- Fewer DB connections used by the notifications poll (at most about one query per 45 seconds per unique request pattern).
- Pool is less likely to be exhausted when many admin users have the dashboard open.
