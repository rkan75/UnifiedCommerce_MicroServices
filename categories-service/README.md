# Categories Service (Spring Boot)

Java Spring Boot service that **replaces** the Medusa Store product categories API: **GET /store/product-categories**. It reads from the **same PostgreSQL database** as Medusa (`product_category` table). The storefront uses this service when `CATEGORIES_SERVICE_URL` is set. Medusa categories API is decommissioned.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/product-categories` | List all categories (optional `?limit=100`). Response: `{ "product_categories": [ ... ] }`. |
| GET | `/store/product-categories?handle=produce` | Get category by handle (exact or last path segment). Response: `{ "product_categories": [ category ] }`. |
| POST | `/store/product-categories` | Create category. Body: `{ "name": "…", "handle": "…", "is_active": true }`. Response: `{ "product_category": { ... } }`. |
| GET | `/store/health` | Health check. |

Response shape matches Medusa Store API so the storefront can use the Java service without code changes.

## Database

- Uses the same Medusa DB (e.g. `grocery_store`).
- **Table**: `product_category` (configurable via `app.categories.table`) with columns: `id`, `name`, `handle`, `description`, `parent_category_id`, and optionally `rank`, `is_active`, `metadata`, `created_at`, `updated_at`. If the table has fewer columns, the service falls back to a minimal query.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_DATASOURCE_URL` | JDBC URL (same as other Java services). | `jdbc:postgresql://127.0.0.1:5433/grocery_store` |
| `SPRING_DATASOURCE_USERNAME` | DB user. | `grocery_app` |
| `SPRING_DATASOURCE_PASSWORD` | DB password. | — |
| `SERVER_PORT` | Server port. | `8085` |
| `CATEGORY_TABLE` | Category table name. | `product_category` |
| `CATEGORY_TABLE_SCHEMA` | Schema. | `public` |

Use the same `.env` at repo root as other Java services.

## Run

```bash
cd categories-service
# Use same DB as other services (e.g. from repo .env)
./restart-dev.sh
```

Service: **http://localhost:8085**. List categories: `GET http://localhost:8085/store/product-categories`.

## Testing the categories service

### 1. Start the service and DB

Ensure the same PostgreSQL database used by Medusa is running (or Cloud SQL Proxy). From repo root you can source `.env` for DB vars. Then:

```bash
cd categories-service
./restart-dev.sh
```

Wait until you see "Started CategoriesApplication". Base URL: **http://localhost:8085** (or http://127.0.0.1:8085).

### 2. Health check

```bash
curl -s http://localhost:8085/store/health
```

Expected: `{"status":"UP","service":"categories-service"}`

### 3. List all categories

```bash
curl -s "http://localhost:8085/store/product-categories"
# With limit
curl -s "http://localhost:8085/store/product-categories?limit=50"
```

Expected: `{"product_categories":[{"id":"...","name":"...","handle":"...", ...}, ...]}`  
If the `product_category` table is empty or missing, you get `{"product_categories":[]}`.

### 4. Get category by handle

```bash
curl -s "http://localhost:8085/store/product-categories?handle=produce"
curl -s "http://localhost:8085/store/product-categories?handle=gift-cards"
```

Expected: `{"product_categories":[{"id":"...","name":"Produce","handle":"produce", ...}]}` or a single-item array. Empty array if not found.

### 5. Create a category (optional)

Used by store backend scripts (e.g. seed-gift-cards). Requires the service to have write access to the `product_category` table.

```bash
curl -s -X POST http://localhost:8085/store/product-categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Category","handle":"test-category","is_active":true}'
```

Expected: `{"product_category":{"id":"pc_...","name":"Test Category","handle":"test-category", ...}}`

### 6. Verify from the storefront

1. In storefront `.env.local` set: `CATEGORIES_SERVICE_URL=http://127.0.0.1:8085`
2. Restart the storefront: `cd unifiedcommerce-grocery-store-storefront && ./restart-dev.sh`
3. Open **http://127.0.0.1:8000/us** — the nav and category links should load (categories come from the Java service).
4. Open a category page, e.g. **http://127.0.0.1:8000/us/categories/produce** — the page uses `getCategoryByHandle(["produce"])` from the Java service.

### Postman

- **GET** `http://localhost:8085/store/product-categories` — list.
- **GET** `http://localhost:8085/store/product-categories?handle=produce` — by handle.
- **POST** `http://localhost:8085/store/product-categories` — Body (raw JSON): `{"name":"Gift Cards","handle":"gift-cards","is_active":true}`.

## Storefront

Set in storefront `.env.local`:

```
CATEGORIES_SERVICE_URL=http://127.0.0.1:8085
```

`listCategories()` and `getCategoryByHandle()` in `lib/data/categories.ts` then use the Java service only. Medusa categories API is not used.

## Other projects

- **Store backend, backoffice, search-service, products-service, cart-service, regions-service**: None of these call the Medusa Store product-categories API. They use `category_id` as a filter (products-service, search-service) or do not use categories at all. No changes required in those services for categories decommission.
