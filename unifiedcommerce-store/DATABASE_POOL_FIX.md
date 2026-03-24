# Database Connection Pool Timeout Fix

This project uses **GCP Cloud SQL** as the database (not Supabase). If you see pool timeouts, use the guidance below.

## Problem

You're experiencing this error:
```
Knex: Timeout acquiring a connection. The pool is probably full. Are you missing a .transacting(trx) call?
```

This happens when the database connection pool is exhausted - all available connections are in use and new requests can't get a connection.

## Root Cause

- Too many concurrent database operations
- Connection pool size is too small
- Connections not being released properly
- Long-running transactions holding connections

## Solution Applied

`medusa-config.ts` configures the database connection pool. Adjust if needed:

```typescript
databaseOptions: {
  pool: {
    min: 2,           // Minimum 2 connections always available
    max: 10,          // Maximum 10 connections (adjust based on Cloud SQL capacity)
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
}
```

## Database: GCP Cloud SQL

- **Local dev:** Start Cloud SQL Proxy (see `deploy/refresh-supabase-from-cloudsql.sh` or `deploy/REFRESH_SUPABASE_FROM_CLOUDSQL.md`), then set `DATABASE_URL` to the proxy (e.g. `postgresql://user:pass@127.0.0.1:5434/postgres`).
- **Deployed (e.g. Cloud Run):** Set `DATABASE_URL` to your Cloud SQL connection (e.g. Unix socket `/cloudsql/PROJECT:REGION:INSTANCE` or private IP).
- **Connection limits:** Cloud SQL has a max connections setting; keep pool `max` below that.

## Additional Steps

### 1. Adjust Pool Size

If you have high concurrency, increase the pool size in config (stay within Cloud SQL max connections).

### 2. Restart Backend

After changing config or `DATABASE_URL`, restart the backend.

### 3. Monitor Connections

In GCP Console → SQL → your instance → Connections, monitor active connections.

## Best Practices

1. **Use transactions properly** - Always use `.transacting(trx)` when doing multiple operations.
2. **Close connections** - Ensure database operations complete and release connections.
3. **Avoid long-running queries** - Optimize slow queries.
4. **Pool size** - Keep `max` below your Cloud SQL instance’s max connections.
