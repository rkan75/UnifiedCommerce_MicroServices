# Cart Service (Java Spring Boot)

Spring Boot service that **implements** the Medusa Store Cart API. It does **not** proxy: all cart operations (create, update, line items, addShippingMethod, complete, transfer, promotions) are implemented against the same PostgreSQL database as Medusa, using tables `commerce_cart`, `commerce_line_item`, `commerce_order`, and `commerce_order_line_item`.

The storefront **requires** **CART_SERVICE_URL** (e.g. `http://localhost:8083`) for all cart operations. Medusa responds with **410** on `/store/carts*` so carts are only served here. Shipping options (`GET /store/shipping-options`) and payment sessions still use the Medusa backend today; those flows may need a Java fulfillment/payment follow-up if you rely on cart-scoped Medusa data.

## Implemented API (replaces sdk.store.cart.*)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/store/carts/:id` | Get cart (response `{ "cart": ... }`; optional `fields` ignored). |
| POST | `/store/carts` | Create cart (body: `region_id`, optional `locale`). |
| PATCH/PUT | `/store/carts/:id` | Update cart (addresses, email, metadata, promo_codes, region_id, locale). |
| POST | `/store/carts/:id/line-items` | Add line item (`variant_id`, `quantity`, optional `metadata`). |
| PATCH/PUT | `/store/carts/:id/line-items/:lineId` | Update line item (quantity, metadata). |
| DELETE | `/store/carts/:id/line-items/:lineId` | Remove line item. (Also `line_items` path.) |
| POST | `/store/carts/:id/shipping-methods` | Add shipping method (`option_id`). |
| POST | `/store/carts/:id/complete` | Complete cart → create order in `commerce_order` / `commerce_order_line_item`. |
| POST | `/store/carts/:id/transfer` | Transfer cart (optionally body `customer_id`). |
| POST | `/store/carts/:id/promotions` | Add promotion codes (body: `{ "promo_codes": ["CODE"] }`). |
| DELETE | `/store/carts/:id/promotions` | Clear promotion codes. |
| POST | `/store/orders/:orderId/sync-cart-metadata` | Copy cart metadata and line-item metadata to order (body: `cart_id`). |
| GET | `/store/health` | Health check. |

## Database

- **Same PostgreSQL** as Medusa (e.g. `gnc_store` on `localhost:5432`). Run **`src/main/resources/schema.sql`** once to create:
  - `commerce_cart`
  - `commerce_line_item`
  - `commerce_order`
  - `commerce_order_line_item`
- Line item prices are resolved from `product_variant` and `price_set_money_amount`. Cart response includes `region` (id, currency_code) from `region` table when present.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Server port | `8083` |
| `SPRING_DATASOURCE_URL` | JDBC URL (same DB as Medusa). For "cannot execute INSERT in a read-only transaction" (25006), ensure you connect to a read-write instance; the service also sets `default_transaction_read_only = off` via Hikari connection-init-sql. | `jdbc:postgresql://localhost:5432/gnc_store` |
| `SPRING_DATASOURCE_USERNAME` | DB user | `grocery_app` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | — |
| `CART_TABLE` | Cart table name | `commerce_cart` |
| `LINE_ITEM_TABLE` | Line item table name | `commerce_line_item` |

## Run

1. **Tables:** Create cart tables once (use the **same** database the service will use):
   ```bash
   cd cart-service && ./run-schema.sh
   ```
   The script loads `../unifiedcommerce-store/.env` (Medusa `DATABASE_URL`) and maps it to `SPRING_DATASOURCE_*`, then `cart-service/.env` if present. Defaults: `localhost:5432/gnc_store` (same as `application.yml`).
2. Start service: `./restart-dev.sh` or `./mvnw spring-boot:run`. If you use `./scripts/start-all.sh`, it loads the repo root `.env` so the cart service uses the same DB URL.

**Important:** The cart service must connect to the **same** database where you ran `run-schema.sh`. If you see "Cart tables not found" or 503 CART_DB_ERROR:
- Check the cart-service log for `Cart service datasource: jdbc:postgresql://...` and run `run-schema.sh` against that host/port/database (or set the same URL in a repo root `.env` and run `start-all.sh` so both use it).

**"Add line item failed" / bad SQL grammar [SELECT * FROM public.commerce_cart ...]:** The cart service cannot see the cart tables—it is using a **different database** than where the tables were created. Fix:
1. From **repo root**, ensure Medusa `unifiedcommerce-store/.env` has the correct `DATABASE_URL`, or set `SPRING_DATASOURCE_URL` / `cart-service/.env` to the same database Medusa uses.
2. Create tables in that DB: `cd cart-service && ./run-schema.sh` (it loads `../.env`; note the "Cart service must use this same DB" line it prints).
3. Start the stack so the cart service gets the same URL: `./scripts/start-all.sh` (it loads repo `.env`).
4. Verify tables exist where the app connects: from repo root run `./cart-service/verify-cart-tables.sh` (uses `.env` credentials so you don't get SASL auth errors). You should see 4 rows. If you see 0 rows or "connection failed", the app is pointing at a different DB or the user/password in `.env` don't match the database; fix `.env` and run run-schema.sh again.

**Read-only transaction (SQL state 25006):** If you see "cannot execute INSERT in a read-only transaction" (or after a **restart** add-to-cart starts failing with 25006), the DB connection is read-only. Do the following in order:

1. **Database and role:** Run as superuser so your Medusa database (e.g. `gnc_store`) and role `grocery_app` are not forced read-only:
   ```bash
   psql -h HOST -p PORT -U postgres -d gnc_store -f fix-readonly-for-app-user.sql
   ```
   Then restart the cart service.

2. **If it still fails:** You are likely connected to a **read replica**. Point `SPRING_DATASOURCE_URL` at the **primary (read-write)** instance, not a replica (e.g. use the primary instance in Cloud SQL Proxy; use the writer endpoint for RDS/Aurora). The service cannot write to a replica. **Cloud SQL users:** If the same INSERT works in Cloud SQL Console but fails in the app, the app is using a read replica or wrong instance—see [docs/CLOUD_SQL_READONLY_FIX.md](docs/CLOUD_SQL_READONLY_FIX.md).

**Ensure the app user can INSERT/UPDATE:** The cart service uses `SPRING_DATASOURCE_USERNAME` (default `grocery_app`). That user must have SELECT, INSERT, UPDATE, DELETE on `public.commerce_cart`, `public.commerce_line_item`, `public.commerce_order`, `public.commerce_order_line_item`. Easiest: run as **superuser** (e.g. postgres or cloudsqlsuperuser):
```bash
psql -h localhost -p 5432 -U postgres -d gnc_store -f ensure-cart-app-user-access.sql
```
That script makes `grocery_app` the **owner** of the four tables so it has full access. If you get "permission denied", the tables are owned by someone else—run `list-cart-table-owners.sql` to see the owner, then run `grant-cart-permissions.sql` as that user.

## Use from storefront and backend

1. **Storefront:** Set `CART_SERVICE_URL=http://localhost:8083` in `.env.local`. All cart operations then use the cart-service; shipping options still use Medusa (`MEDUSA_BACKEND_URL`).
2. **Backend:** No code changes required. When the storefront uses the cart-service and completes the cart, the order is created in `commerce_order` and the storefront calls the cart-service’s `POST /store/orders/:orderId/sync-cart-metadata` to copy metadata.

## Health

- **GET** `/store/health` → `{ "status": "UP", "service": "cart-service" }`.

## Postman

Import **`postman/Cart-Service-API.postman_collection.json`**. Set variables:

- `base_url` = `http://localhost:8083`
- `region_id` = from Java regions-service **GET** `/store/regions` (e.g. http://localhost:8084/store/regions)
- After **Create cart**, set `cart_id` from response.
- `variant_id` = from products-service or Medusa products.

Then run **Create cart**, **Add line item**, **Get cart**, **Update line item**, **Add shipping method**, **Add promotion code**, **Complete cart**, etc.

## Relation to Medusa

- **Cart and orders** are stored in this service’s tables. Medusa cart/order modules are not used when `CART_SERVICE_URL` is set.
- **Shipping options** (list and calculate) are still provided by the Medusa backend; the storefront continues to call `MEDUSA_BACKEND_URL` for `/store/shipping-options`.
- **Regions** are read from the shared `region` table (same DB as the Java regions-service) when building the cart response.
