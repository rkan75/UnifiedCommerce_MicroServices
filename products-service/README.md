# Products Service (Spring Boot)

Java Spring Boot service that **fully replaces** the Medusa Store product API: **GET /store/products** and **GET /store/product-variants/:id** (and batch variants). It reads from the **same PostgreSQL database** as Medusa. The storefront and backend use this service when `PRODUCTS_SERVICE_URL` is set.

Based on [MEDUSA_SDK_APIS_USED.md](../unifiedcommerce-grocery-store-storefront/docs/MEDUSA_SDK_APIS_USED.md) §8.

## API

### GET /store/products (replaces Medusa GET /store/products)

Query parameters (aligned with Medusa Store API):

| Parameter       | Type     | Description |
|----------------|----------|-------------|
| `limit`        | int      | Page size (default 12, max 100). |
| `offset`       | int      | Pagination offset. |
| `region_id`    | string   | Used for variant price resolution (products-service reads `currency_code` from the same DB `region` table; no HTTP call to regions-service). |
| `handle`       | string   | Filter by product handle (single product). |
| `id`           | string[] | Filter by product ID(s). |
| `q`            | string   | Search in title/description (AND of words). |
| `category_id`  | string   | Filter by category (uses `product_category_product` link table: product_id, product_category_id). |
| `collection_id`| string   | Filter by collection (requires `product.collection_id` column). |
| `type_id`      | string   | Filter by Medusa product type (`product.type_id`). |
| `order`        | string   | Sort: `created_at`, `-created_at`, `title`, `-title`, `handle`, `-handle`. |
| `fields`       | string   | Ignored; response is full StoreProduct-like shape. Each product includes `type: { id, value }` when `product_type` join is enabled (default). |

**Response:** `{ "products": [ { "id", "title", "handle", "description", "thumbnail", "status", "variants", "metadata" }, ... ], "count": N }`

Each product includes `variants[]` with `id`, `title`, `sku`, and `calculated_price: { calculated_amount, currency_code }` (when available from `price_set_money_amount`).

### GET /store/product-variants/:variantId (replaces Medusa GET /store/product-variants/:id)

| Parameter    | Description |
|-------------|-------------|
| Path        | `variantId` — variant ID. |
| `region_id` | Optional; used for price resolution. |

**Response:** `{ "variant": { "id", "product_id", "title", "sku", "calculated_price", "metadata" } }` or **404** if not found.

Used by storefront `lib/data/variants.ts` (retrieveVariant) and `lib/data/wishlist.ts` (getProductIdByVariantId).

### GET /store/product-variants?id=... (batch variant lookup)

| Parameter    | Description |
|-------------|-------------|
| `id`        | List of variant IDs. |
| `region_id` | Optional; used for price resolution. |

**Response:** `{ "variants": [ { "id", "product_id", "title", "sku", "calculated_price", "metadata" }, ... ] }`

Used by backend `src/api/admin/orders/[id]/weight-detail/route.ts`.

### GET /store/health

Health check: `{ "status": "UP", "service": "products-service" }`.

## Requirements

- Java 17+
- Maven (or use Maven Wrapper from `search-service`: copy `.mvn` and `mvnw` from there, or `brew install maven`)
- PostgreSQL: same Medusa database (read-only recommended).

## Configuration

Environment variables (or `application.yml`):

| Variable | Description |
|----------|-------------|
| `SPRING_DATASOURCE_URL` | JDBC URL, e.g. `jdbc:postgresql://localhost:5433/grocery_store`. |
| `SPRING_DATASOURCE_USERNAME` | DB user. |
| `SPRING_DATASOURCE_PASSWORD` | DB password. |
| `SERVER_PORT` | Port (default **8082**). |
| `MEDUSA_PRODUCT_TABLE` | Product table name (default `product`). |
| `MEDUSA_VARIANT_TABLE` | Variant table name (default `product_variant`). |
| `MEDUSA_REGION_TABLE`  | Region table name (default `region`); used to resolve `currency_code` when `region_id` is sent (same as Medusa Store API). |
| `MEDUSA_PRODUCT_CATEGORY_LINK_TABLE` | Link table name (default `product_category_product`). Must have columns `product_id`, `product_category_id`. SQL uses lowercase. |
| `MEDUSA_PRODUCT_CATEGORY_LINK_CATEGORY_COLUMN` | Category column in link table (default `product_category_id`). |

## Category filter and fallback

When the storefront requests products with `category_id` (e.g. from a category menu), the service filters using the **product–category link table** (`product_category_product` by default) with columns `product_id` and `product_category_id`. All table and column names are lowercased in the SQL, e.g. `EXISTS (SELECT 1 FROM product_category_product pcl WHERE pcl.product_id = p.id AND pcl.product_category_id = ?)`.

- If that table is missing, the service catches the error and returns products **without** the category filter so the site does not break.
- If the filter returns **0 products** (e.g. no rows in the link table for that category), the service **returns 0 products** (it does not fall back to unfiltered). Ensure products are linked to categories in `product_category_product` for category pages to show the correct items.

To get proper per-category filtering:

1. Ensure the table exists (Medusa v2 migrations usually create it):  
   `CREATE TABLE IF NOT EXISTS product_category_product (product_id TEXT, product_category_id TEXT, ...);`
2. Link products to categories (via Medusa Admin or API, or by inserting into `product_category_product` with `product_id` and `product_category_id` matching `product.id` and `product_category.id`).

### Debug: see the category filter query

When you select a category, the service runs a query that includes the category filter. To see the exact SQL in the logs:

- **INFO logs:** The service logs the COUNT and DATA queries at INFO level whenever a category filter is applied. Restart the products-service and select a category; in the console you will see lines like:
  - `[products-service] Category filter: category_id=... | COUNT query: SELECT COUNT(*) FROM product p WHERE ...`
  - `[products-service] Category filter: DATA query: SELECT p.id, p.title, ... FROM product p WHERE ... AND EXISTS (SELECT 1 FROM product_category_product pcl WHERE pcl.product_id = p.id AND pcl.product_category_id = ?) ORDER BY ... LIMIT ? OFFSET ?`
- **DEBUG logs:** To also see the bound parameters, set in `application.yml` or env:  
  `logging.level.com.tcs.commerce.products.service=DEBUG`

Example when you open e.g. "Produce" (category_id = `pcat_01ABC`, limit 12, offset 0):

- **COUNT query:**  
  `SELECT COUNT(*) FROM product p WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM product_category_product pcl WHERE pcl.product_id = p.id AND pcl.product_category_id = ?) ORDER BY p.created_at DESC LIMIT ? OFFSET ?`  
  Params: `[pcat_01ABC, 12, 0]` (for the DATA query; COUNT uses only `[pcat_01ABC]`).
- **DATA query:**  
  Same WHERE and EXISTS clause, with `SELECT p.id, p.title, p.handle, p.description, p.thumbnail, p.status, p.metadata, p.created_at` and `LIMIT 12 OFFSET 0`.

## Schema (Medusa DB)

- **product**: `id`, `title`, `handle`, `description`, `thumbnail`, `status`, `metadata`, `deleted_at`, `created_at`.
- **product_variant**: `id`, `product_id`, `title`, `sku`, `deleted_at`; optional `price_set_id` for pricing.
- **region**: `id`, `currency_code` — used when `region_id` is sent (same as Medusa Store API). The service picks the variant price whose `currency_code` matches the region’s currency.

The service tries **four** pricing schemas so variant price is picked up whenever it exists in the DB:

1. **price_set_money_amount** with `amount`, `currency_code` on the same table; join `product_variant.price_set_id` → `price_set_money_amount.price_set_id`.
2. **price_set_money_amount** (link) + **money_amount**: `price_set_money_amount.money_amount_id` → `money_amount.id` for `amount`, `currency_code`.
3. **price** table: `price.price_set_id` = `product_variant.price_set_id`, columns `amount`, `currency_code`.
4. **Link table** (Medusa v2 style): **product_variant_price_set** (`variant_id`, `price_set_id`) → **price** (`price_set_id`, `amount`, `currency_code`).

Amounts from the DB (e.g. PostgreSQL `numeric`/`BigDecimal`) are normalized to minor units (long). Response shape matches Medusa Store API: `calculated_price: { calculated_amount, currency_code, original_amount, price_list_type }`.

## Build and run

```bash
cd products-service
# Use Maven (if installed)
mvn spring-boot:run

# Or copy mvnw + .mvn from search-service and run:
# ./mvnw spring-boot:run
```

Default port: **8082**. Or use the restart script (kills any process on 8082 first):

```bash
./restart-dev.sh
```

---

## Testing with Postman

### Step 1: Start the products service

Ensure PostgreSQL is running and configured (see [Configuration](#configuration)). From the `products-service` directory:

```bash
./restart-dev.sh
```

Wait until you see `Started ProductsApplication in X seconds`. The API is at **http://localhost:8082**.

### Step 2: Health check in Postman

1. Open **Postman**.
2. **New** → **HTTP Request**.
3. Set **Method** to **GET**.
4. URL: **`http://localhost:8082/store/health`**
5. Click **Send**.

**Expected response (200):**

```json
{
  "status": "UP",
  "service": "products-service"
}
```

If you get "Connection refused", the service is not running or the port is wrong.

### Step 3: List products (no filters)

1. New request, **GET**.
2. URL: **`http://localhost:8082/store/products`**
3. **Params** tab (optional):
   - `limit` = `12`
   - `offset` = `0`
   - `region_id` = region ID from Java regions-service GET /store/regions (e.g. http://localhost:8084/store/regions)
4. **Send**.

**Expected (200):** JSON body with `products` (array) and `count` (total). Example:

```json
{
  "products": [
    {
      "id": "prod_01...",
      "title": "Organic Bananas",
      "handle": "organic-bananas",
      "description": "...",
      "thumbnail": "...",
      "status": "published",
      "variants": [ { "id": "...", "title": "...", "sku": "...", "calculated_price": { "calculated_amount": 199, "currency_code": "usd" } } ],
      "metadata": null
    }
  ],
  "count": 1
}
```

If the DB is empty or tables differ, you may get `products: []` and `count: 0`, or a 503 if the database is unavailable (see logs).

### Step 4: Get product by handle

1. **GET** **`http://localhost:8082/store/products`**
2. **Params**:
   - `handle` = a product handle from your DB (e.g. `organic-bananas`)
   - `limit` = `1`
3. **Send**.

**Expected:** 200 with a single product in `products` (or empty if handle not found).

### Step 5: Search by text (q)

1. **GET** **`http://localhost:8082/store/products`**
2. **Params**:
   - `q` = `banana` (or any text in product title/description)
   - `limit` = `10`
   - `offset` = `0`
3. **Send**.

**Expected:** 200 with `products` whose title or description contains the search term(s) (case-insensitive, AND for multiple words), and `count` with the total.

### Step 6: Pagination and sort

1. **GET** **`http://localhost:8082/store/products`**
2. **Params**:
   - `limit` = `5`
   - `offset` = `0`
   - `order` = `-created_at` (newest first) or `title` (title A–Z)
3. **Send**.

**Expected:** 200 with up to 5 products and correct `count`. Change `offset` to `5` for the next page.

### Troubleshooting

| Issue | What to check |
|-------|----------------|
| Connection refused | Service not running; run `./restart-dev.sh` from `products-service`. Port 8082 free (script kills existing process). |
| 503 Database unavailable | PostgreSQL not running or wrong `SPRING_DATASOURCE_*`. Check `application.yml` or env vars. |
| Empty products / count 0 | DB has no rows in `product` table, or table names differ; set `MEDUSA_PRODUCT_TABLE` / `MEDUSA_VARIANT_TABLE` if needed. |

---

## Storefront integration

To use this service **instead of Medusa** for product listing:

1. **Option A – Proxy:** Keep the storefront pointing at the Medusa backend URL. Add a reverse proxy (e.g. Nginx or Next.js rewrite) so that `/store/products` is forwarded to `http://products-service:8082/store/products`.

2. **Option B – Env override:** In the storefront, introduce an optional env var (e.g. `NEXT_PUBLIC_PRODUCTS_API_URL`) and in `lib/data/products.ts` call this service for `listProducts` when the var is set, otherwise use `sdk.client.fetch` to Medusa.

   Example in `products.ts`:

   ```ts
   const productsBase = process.env.PRODUCTS_API_URL || process.env.MEDUSA_BACKEND_URL
   const url = `${productsBase}/store/products?${new URLSearchParams({ limit, offset, region_id, ... })}`
   const res = await fetch(url, { headers: await getAuthHeaders(), next: await getCacheOptions('products') })
   const { products, count } = await res.json()
   ```

3. **Option C – Full backend URL switch:** Point `MEDUSA_BACKEND_URL` to an API gateway that routes `/store/products` to this service and all other paths to Medusa. Then no storefront code changes are needed.

## Relation to search-service

- **search-service**: GET `/search` — text search, returns `{ products, count }` for search UIs.
- **products-service**: GET `/store/products` — full Store API replacement for listing/browsing with pagination, handle, id, q, region_id.

Both use the same Medusa DB and can run side by side (different ports).
