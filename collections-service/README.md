# Collections Service (Spring Boot)

Java Spring Boot service that **replaces** the Medusa Store collections API: **GET /store/collections** and **GET /store/collections/:id**. It reads from the **same PostgreSQL database** as Medusa (`product_collection` table). The storefront uses this service when `COLLECTIONS_SERVICE_URL` is set. Medusa collections API is decommissioned.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/collections` | List collections (optional `?limit=100`, `?offset=0`). Response: `{ "collections": [ ... ] }`. |
| GET | `/store/collections?handle=summer` | Get collection by handle. Response: `{ "collections": [ collection ] }`. |
| GET | `/store/collections/:id` | Get collection by ID. Response: `{ "collection": { ... } }`. |
| GET | `/store/health` | Health check. |

Response shape matches Medusa Store API so the storefront can use the Java service without code changes.

## Database

- **Table:** `product_collection` (configurable via `COLLECTION_TABLE`; default `product_collection`).
- **Columns used:** `id`, `title` (or `name`), `handle`, `created_at`, `updated_at`, optional `metadata`, optional `deleted_at`.
- Same DB as Medusa (e.g. `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`).

## Configuration

| Env / property | Description |
|----------------|-------------|
| `SERVER_PORT` | Server port (default 8086). |
| `SPRING_DATASOURCE_URL` | JDBC URL (e.g. `jdbc:postgresql://127.0.0.1:5433/grocery_store`). |
| `COLLECTION_TABLE` | Table name (default `product_collection`). |
| `COLLECTION_TABLE_SCHEMA` | Schema (default `public`). |

## Run

```bash
# From repo root, ensure DB is up and .env has SPRING_DATASOURCE_* if needed
cd collections-service
./restart-dev.sh
```

Service runs at `http://localhost:8086` (or `http://127.0.0.1:8086`).

## Test

```bash
curl -s http://127.0.0.1:8086/store/health
curl -s "http://127.0.0.1:8086/store/collections?limit=10"
curl -s "http://127.0.0.1:8086/store/collections?handle=summer"
curl -s http://127.0.0.1:8086/store/collections/<id>
```

## Storefront integration

Set in storefront `.env.local`:

```env
COLLECTIONS_SERVICE_URL=http://127.0.0.1:8086
```

The storefront `lib/data/collections.ts` uses this URL for all collection requests; Medusa collections API is not called.
