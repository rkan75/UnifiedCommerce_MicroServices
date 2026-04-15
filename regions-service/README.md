# Regions Service (Spring Boot)

Java Spring Boot service that **replaces** the Medusa Store regions API: **GET /store/regions** and **GET /store/regions/:id**. It reads from the **same PostgreSQL database** as Medusa (`region` and `country` tables). The storefront and middleware use this service when `REGIONS_SERVICE_URL` is set.

Based on [MEDUSA_SDK_APIS_USED.md](../unifiedcommerce-grocery-store-storefront/docs/MEDUSA_SDK_APIS_USED.md) (Store API regions).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/regions` | List all regions with their countries (Medusa-compatible response: `{ "regions": [...] }`). |
| GET | `/store/regions/:id` | Get a single region by id (response: `{ "region": { ... } }`). |
| GET | `/store/health` | Health check. |

Response shape matches Medusa Store API so the storefront can use either Medusa or this service without code changes.

## Database

- Uses the same Medusa DB (e.g. `grocery_store`).
- **Region table**: `id`, `name`, `currency_code`, `automatic_taxes`, `metadata`, `created_at`, `updated_at` (configurable via `app.regions.region-table`, default `region`).
- **Country table**: `iso_2`, `iso_3`, `name`, `display_name`, `num_code`, `region_id` (configurable via `app.regions.country-table`, default `country`). Countries are linked to regions via `region_id`.

If the `country` table or `region_id` column does not exist, regions are still returned with an empty `countries` array.

## Configuration

Environment variables (or `application.yml`):

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_DATASOURCE_URL` | JDBC URL (same as Medusa / products-service). | `jdbc:postgresql://127.0.0.1:5433/grocery_store` |
| `SPRING_DATASOURCE_USERNAME` | DB user. | `grocery_app` |
| `SPRING_DATASOURCE_PASSWORD` | DB password. | — |
| `SERVER_PORT` | Server port. | `8084` |
| `REGION_TABLE` | Region table name. | `region` |
| `COUNTRY_TABLE` | Country table name. | `country` |
| `REGION_TABLE_SCHEMA` | Schema (e.g. `public`). | `public` |

Use the same `.env` at repo root as other Java services (see [.env.example](../.env.example)) so that `SPRING_DATASOURCE_*` are consistent.

## Run

From repo root (recommended):

```bash
# Use same DB as other services
export SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5433/grocery_store
export SPRING_DATASOURCE_USERNAME=grocery_app
export SPRING_DATASOURCE_PASSWORD=YourPassword
cd regions-service && ./restart-dev.sh
```

Or with repo `.env`:

```bash
source ../.env
cd regions-service && ./restart-dev.sh
```

Service will be at **http://localhost:8084**. List regions: `GET http://localhost:8084/store/regions`.

## Testing the regions service

### Prerequisites

- Regions service is running (see [Run](#run)).
- Database has `region` (and optionally `country`) tables with data (same Medusa DB).

### 1. Health check

```bash
curl -s http://localhost:8084/store/health
```

Expected: `{"status":"UP","service":"regions-service"}`

### 2. List all regions

```bash
curl -s http://localhost:8084/store/regions
```

Expected: JSON with a `regions` array. Example:

```json
{
  "regions": [
    {
      "id": "reg_...",
      "name": "North America",
      "currency_code": "usd",
      "automatic_taxes": true,
      "countries": [
        { "iso_2": "us", "iso_3": "usa", "name": "United States", "display_name": "United States", "num_code": "840" }
      ],
      "metadata": null,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

If the `country` table is missing or has no rows, `countries` may be `[]` or `null`.

### 3. Get a single region by ID

First get a region `id` from the list response above, then:

```bash
curl -s http://localhost:8084/store/regions/<REGION_ID>
```

Example (replace with a real id from your DB):

```bash
curl -s http://localhost:8084/store/regions/reg_01ABC123
```

Expected: `{ "region": { "id": "...", "name": "...", "currency_code": "...", ... } }`

If the ID does not exist: HTTP **404**.

### 4. Postman

| Method | URL | Notes |
|--------|-----|--------|
| GET | `http://localhost:8084/store/health` | Health check |
| GET | `http://localhost:8084/store/regions` | List all regions |
| GET | `http://localhost:8084/store/regions/{{region_id}}` | Get one region; set `region_id` from list response |

No request body or special headers required. Optional: add a header `x-publishable-api-key: <your_key>` if you use it in production.

### 5. Test from the storefront

1. In the storefront `.env.local`, set:
   ```bash
   REGIONS_SERVICE_URL=http://localhost:8084
   ```
2. Restart the storefront and open the site (e.g. http://localhost:8000).
3. Middleware and region-dependent pages will use the Java regions service. Check the network tab: requests to `/store/regions` should go to the storefront (which in turn calls the regions service server-side).

## Storefront integration

Set in the storefront `.env.local`:

```bash
REGIONS_SERVICE_URL=http://localhost:8084
```

When `REGIONS_SERVICE_URL` is set:

- `lib/data/regions.ts` uses the Java regions service for `listRegions()` and `retrieveRegion(id)`.
- Middleware uses it for region resolution (country code → region) instead of Medusa.

If `REGIONS_SERVICE_URL` is not set, the storefront continues to use the Medusa backend for regions.

## Products service and region

The **products-service** does not call this regions service over HTTP. It uses the **same database** and reads the `region` table directly to resolve `currency_code` for variant pricing (see `getRegionCurrencyCode` in products-service). So:

- Regions **data** (list regions, get region by id) is served by this **regions-service** when the storefront is configured with `REGIONS_SERVICE_URL`.
- **Variant prices** by region are still resolved inside the products-service using the shared DB `region` table; no HTTP call to the regions-service is required.

## Start with other services

From repo root:

```bash
./scripts/start-all.sh
```

This starts search, products, cart, **regions**, Medusa backend, storefront, and backoffice. Regions API: http://localhost:8084.
