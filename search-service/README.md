# Search Service (Spring Boot)

Item search microservice that reads from the **same PostgreSQL database as Medusa** and exposes a REST API for the storefront. Based on [SPRINGBOOT_SEARCH_MICROSERVICE.md](../unifiedcommerce-grocery-store-storefront/docs/SPRINGBOOT_SEARCH_MICROSERVICE.md).

## Features

- **GET /search** – Text search on product title and description (`q`), with optional `priceMin`, `priceMax`, `region_id`, `category_id`, `collection_id`, `limit`, `offset`. For product-by-ID use **GET /search?id=prod_xxx** (returns one product with variants and prices).
- **GET /search/health** – Health check.
- **Read-only** – Uses a read-only DB connection when possible; no writes to Medusa tables.
- **Response shape** – Returns `{ products: [...], count: N }` so the Next.js storefront can use it with minimal mapping.

## Requirements

- Java 17+
- **Maven** – Either install Maven (`brew install maven` on macOS) or use the included **Maven Wrapper** (`./mvnw`) so you don't need Maven installed.
- **PostgreSQL** – The search service must connect to the same PostgreSQL database as your Medusa backend (or a read replica). If PostgreSQL is not running, the app will start but **GET /search** will return **503** with a clear JSON error until the database is available.

### "Connection to localhost:5432 refused"

This means PostgreSQL is not running or not reachable at `localhost:5432`.

1. **Start PostgreSQL** (e.g. `brew services start postgresql@14` on macOS, or start your Medusa/Postgres stack).
2. **Or** point to a remote DB: set `SPRING_DATASOURCE_URL=jdbc:postgresql://your-host:5432/your_db`, plus username/password.
3. **GET /search/health** will still return 200; **GET /search** will return 503 with `{"error":"Database unavailable","message":"..."}` until the database is running and credentials are correct.

### "Connection is not available, request timed out after 30006ms"

The pool is waiting too long for a free or new connection. Common causes:

1. **Database slow or overloaded** – Postgres may be under load or slow to accept connections. Ensure the DB is up and not at `max_connections`.
2. **Wrong URL or credentials** – If the JDBC URL has credentials in the host part (e.g. `jdbc:postgresql://user:pass@host/...`), fix it: use **host:port/database** only and set `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD` separately.
3. **Pool / timeout tuning** – In `application.yml`, `connection-timeout` is set to 60000 (60s) and `maximum-pool-size` to 20. If you have very high concurrency, increase `maximum-pool-size`; if the DB is slow to respond, ensure the DB and network are healthy.

## Configuration

Set environment variables (or `application.yml`):

| Variable | Description |
|----------|-------------|
| `SPRING_DATASOURCE_URL` | JDBC URL, e.g. `jdbc:postgresql://localhost:5432/grocery_store`. Derive from Medusa `DATABASE_URL`: replace `postgresql://` with `jdbc:postgresql://`. |
| `SPRING_DATASOURCE_USERNAME` | DB user (prefer read-only for this service). |
| `SPRING_DATASOURCE_PASSWORD` | DB password. |
| `SERVER_PORT` | Port (default `8081`). |
| `MEDUSA_DB_SCHEMA` | Schema name if Medusa uses one (default `public`). |
| `MEDUSA_PRODUCT_TABLE` | Product table name (default `product`). Adjust if your Medusa version uses a different name. |

### Example: from Medusa `DATABASE_URL`

```bash
# Medusa
DATABASE_URL=postgresql://grocery_app:secret@localhost:5432/grocery_store

# Search service (same DB)
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/grocery_store
export SPRING_DATASOURCE_USERNAME=grocery_app
export SPRING_DATASOURCE_PASSWORD=secret
```

## Schema alignment (Medusa v2)

Medusa v2 creates tables via migrations. The exact table and column names can vary. This service assumes a **product** table with at least:

- `id`, `title`, `handle`, `description`, `thumbnail`, `status`, `metadata`, `created_at`, `deleted_at`

If your Medusa schema differs (e.g. different table name, schema, or columns):

1. **Option A** – Set `MEDUSA_PRODUCT_TABLE` (and `MEDUSA_DB_SCHEMA` if needed) to match your product table.
2. **Option B** – Create a **database view** that matches the expected columns and set `MEDUSA_PRODUCT_TABLE` to that view name.

Example view (adjust to your actual Medusa schema):

```sql
CREATE VIEW search_product AS
SELECT id, title, handle, description, thumbnail, status, metadata, created_at, deleted_at
FROM product;
```

Then set `MEDUSA_PRODUCT_TABLE=search_product`.

## Build and run

From the `search-service` directory:

```bash
# Use Maven Wrapper (no Maven install needed; recommended)
chmod +x mvnw
./mvnw spring-boot:run

# Or if you have Maven installed
mvn spring-boot:run
```

Build a JAR:

```bash
./mvnw -q package
# or: mvn -q package
java -jar target/search-service-1.0.0-SNAPSHOT.jar
```

**If `mvn` is not found:** Use `./mvnw` instead (included in the project). On first run it will download Maven automatically.

**If you see "Unable to locate a Java Runtime":** The script tries to find Java via `java_home`, then Homebrew paths (`/opt/homebrew/opt/openjdk@17`, etc.). If it still fails:

1. **Install a JDK** (e.g. OpenJDK 17):  
   `brew install openjdk@17`  
   Then add to your `~/.zshrc`:  
   `export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"`  
   (On Intel Macs, use `/usr/local/opt/openjdk@17/`; run `brew info openjdk@17` to see the path.)

2. **Or** if Java is already installed, find it:  
   `which java` and `java -version`. Then set `JAVA_HOME` to the JDK root (the directory that contains `bin/java`), e.g.  
   `export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"`

3. Open a **new terminal** (or run `source ~/.zshrc`) and run `./mvnw spring-boot:run` again.

## API

### GET /search

| Query param | Type | Description |
|-------------|------|-------------|
| `q` | string | Search text (title/description). |
| `priceMin` | number | Min price in dollars (optional; in-memory filter if view provides price). |
| `priceMax` | number | Max price in dollars (optional). |
| `region_id` | string | Reserved for future price/region handling. |
| `category_id` | string | Reserved for category filter. |
| `collection_id` | string | Reserved for collection filter. |
| `limit` | int | Page size (default 12, max 100). |
| `offset` | int | Offset for pagination. |

**Response:** `{ "products": [ { "id", "title", "handle", "description", "thumbnail", "status", "variants", "metadata" }, ... ], "count": N }`

---

## Testing with Postman (step-by-step)

### Step 1: Configure the database

Set the same PostgreSQL connection as your Medusa backend (or use a test DB). In the same terminal where you will run the service:

```bash
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/grocery_store"
export SPRING_DATASOURCE_USERNAME="grocery_app"
export SPRING_DATASOURCE_PASSWORD="your_password"
```

Or create `search-service/src/main/resources/application-local.yml` (don’t commit real passwords) with:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/grocery_store
    username: grocery_app
    password: your_password
```

Then run with: `./mvnw spring-boot:run --spring.profiles.active=local`

### Step 2: Start the search service

From the `search-service` directory:

```bash
./mvnw spring-boot:run
```

Wait until you see something like: `Started SearchServiceApplication in X seconds`. The API will be at **http://localhost:8081** (or the port in `application.yml`).

### Step 3: Health check in Postman

1. Open **Postman**.
2. **New** → **HTTP Request**.
3. Set **Method** to **GET**.
4. URL: **`http://localhost:8081/search/health`**
5. Click **Send**.

**Expected response (200):**

```json
{
  "status": "UP",
  "service": "search-service"
}
```

If you get “Connection refused”, the service is not running or the port is wrong.

### Step 4: Search (no query) – list products

1. New request, **GET**.
2. URL: **`http://localhost:8081/search`**
3. (Optional) **Params** tab: add `limit` = `5`, `offset` = `0`.
4. **Send**.

**Expected:** `200` with body like:

```json
{
  "products": [ ... ],
  "count": 5
}
```

If the DB has no `product` table or it’s empty, you may get `count: 0` and `products: []`, or an error (check service logs and [Schema alignment](#schema-alignment-medusa-v2)).

### Step 5: Search with query (q)

1. **GET** **`http://localhost:8081/search`**
2. **Params**:
   - `q` = `tea` (or any text that might appear in product title/description)
   - `limit` = `10`
   - `offset` = `0`
3. **Send**.

**Expected:** `200` with `products` containing items whose title or description matches “tea” (case-insensitive), and `count` with the total number of matches.

Example URL:  
`http://localhost:8081/search?q=tea&limit=10&offset=0`

### Step 6: Pagination

1. **GET** **`http://localhost:8081/search?q=organic&limit=5&offset=0`** → first 5 results.
2. **GET** **`http://localhost:8081/search?q=organic&limit=5&offset=5`** → next 5 results.

### Step 7: Optional parameters (if your schema supports them)

You can add these as query params in Postman; the service accepts them (they may not filter until you extend the backend):

- `priceMin` – number (e.g. `2`)
- `priceMax` – number (e.g. `10`)
- `region_id` – string
- `category_id` – string
- `collection_id` – string

Example:  
`http://localhost:8081/search?q=tea&limit=12&offset=0&priceMax=5`

---

### Quick reference – Postman

| What              | Method | URL |
|-------------------|--------|-----|
| Health            | GET    | `http://localhost:8081/search/health` |
| Search (all)      | GET    | `http://localhost:8081/search?limit=5` |
| Search by text    | GET    | `http://localhost:8081/search?q=tea&limit=10` |
| Search + paginate | GET    | `http://localhost:8081/search?q=tea&limit=5&offset=5` |

If you get **500** or empty results, check that the Medusa database has a **product** table and that `MEDUSA_PRODUCT_TABLE` (default `product`) matches your schema; see [Schema alignment](#schema-alignment-medusa-v2) above.

---

## Storefront integration

1. Set the search service base URL in the storefront (e.g. `SEARCH_SERVICE_URL=http://localhost:8081` or `NEXT_PUBLIC_SEARCH_SERVICE_URL` for client-side).
2. In the storefront data layer (`src/lib/data/products.ts` or a new module), when performing **search** (e.g. when `q` is present), call this service instead of Medusa:
   - `GET {SEARCH_SERVICE_URL}/search?q=...&limit=12&offset=0`
3. Map the response to your existing `StoreProduct`-like shape, or use the returned product IDs and call Medusa `GET /store/products?id=...` for full product + price details (recommended so Medusa remains source of truth for pricing).

See [SPRINGBOOT_SEARCH_MICROSERVICE.md](../unifiedcommerce-grocery-store-storefront/docs/SPRINGBOOT_SEARCH_MICROSERVICE.md) for full architecture and options.

## License

Same as the parent project.
