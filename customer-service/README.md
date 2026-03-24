# Customer Service (Spring Boot)

Java Spring Boot service that **replaces** the Medusa Store customer API and **customer auth**. Medusa customer and auth are **decommissioned**; the storefront and store backend use this service only.

- **Customer:** GET /store/customers/me, PATCH /store/customers/me, address CRUD (same DB: `customer`, `address`).
- **Auth:** Register, login, logout, password reset (table `customer_auth`; JWT issued by this service).

**CUSTOMER_SERVICE_URL is required** in the storefront and (for proxied customer login/register) in the store backend. No fallback to Medusa.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/customers/me` | Get current customer (requires `Authorization: Bearer <token>`). |
| POST / PATCH | `/store/customers/me` | Update customer profile. |
| POST | `/store/customers/me/addresses` | Create address. |
| PATCH | `/store/customers/me/addresses/:id` | Update address. |
| DELETE | `/store/customers/me/addresses/:id` | Delete address. |
| POST | `/auth/customer/emailpass/register` | Register (body: email, password, first_name, last_name, phone). Returns `{ token }`. |
| POST | `/auth/customer/emailpass` | Login (body: email, password). Returns `{ token }`. |
| POST | `/auth/logout` | Logout (stateless; client clears cookie). |
| POST | `/auth/customer/emailpass/reset-password` | Request reset (body: identifier = email). |
| POST | `/auth/customer/emailpass/update-password` | Reset with token (body: password; header or body: token). |
| GET | `/store/health` | Health check. |

## Configuration

| Env | Description |
|-----|-------------|
| `JWT_SECRET` | **Required.** Secret for signing and validating JWTs (this service issues tokens). Must be set or registration/login return 503. Use at least 32 characters (e.g. `openssl rand -hex 32`). |
| `SPRING_DATASOURCE_URL` | JDBC URL (same DB as customer/address). |
| `CUSTOMER_TABLE` | Customer table name (default `customer`). |
| `ADDRESS_TABLE` | Address table name (default `address`). If create address returns 400 "Create address failed", ensure the table exists (run `schema-address.sql` or use Medusa's address table). |
| `AUTH_TABLE` | Auth table name (default `customer_auth`). Run `schema-auth.sql` once. |
| `SERVER_PORT` | Port (default 8087). |

## Where to set JWT_SECRET

Set `JWT_SECRET` in the environment where the customer-service runs:

- **Local (restart-dev.sh):**  
  ```bash
  export JWT_SECRET=your_secret_at_least_32_chars
  ./restart-dev.sh
  ```
  Or create a `.env` in the `customer-service` directory with `JWT_SECRET=...` and source it before running, or use a tool that loads `.env` (e.g. `dotenv`).

- **Same as store backend:** You can use the same value as the store backend’s `JWT_SECRET` if you want tokens to be compatible; the customer-service issues its own tokens and only needs a non-empty secret of at least 32 characters.

- **Generate a secret:**  
  `openssl rand -hex 32`

If `JWT_SECRET` is not set, the service starts but registration and login return **503** with a message asking you to set it. The startup log will also show an ERROR.

## Run

1. **Create the auth table (required once).** Without this, registration will create customer rows but **login will always return "Invalid email or password"** and re-register will say "email already existing".
   ```bash
   psql -h HOST -p PORT -U USER -d DB -f customer-service/src/main/resources/schema-auth.sql
   ```
2. **Create the address table if needed.** If adding an address returns "Create address failed", create the table:
   ```bash
   psql -h HOST -p PORT -U USER -d DB -f customer-service/src/main/resources/schema-address.sql
   ```
   (If you use Medusa's existing `address` table, you can skip this; the service will use it when column names match.)
3. Set `JWT_SECRET` (see above).
4. Start service:
   ```bash
   cd customer-service
   export JWT_SECRET=your_secret_at_least_32_chars
   ./restart-dev.sh
   ```

## Troubleshooting

| Symptom | Cause | Fix |
|--------|--------|-----|
| **FATAL: SASL authentication failed** (HikariPool) | DB user `grocery_app` missing or password in `.env` doesn't match PostgreSQL | Ensure PostgreSQL has user `grocery_app` with the same password as `SPRING_DATASOURCE_PASSWORD` in `.env`. Create user: `deploy/01-create-database-multilingual.sql` (or `deploy/01-create-database.sql`). Reset password: `ALTER USER grocery_app WITH PASSWORD 'UnifiedCommerce@1';` (match the value in your `.env`). |
| "Invalid email or password" on login (correct credentials) | `customer_auth` table missing or empty | Run `schema-auth.sql` (step 1 above). Then register again with a **new** email, or use an existing user that has a row in `customer_auth`. |
| "Email already existing" on register but login fails | Customer row exists but no row in `customer_auth` (auth insert failed, often because table was missing) | Run `schema-auth.sql`. Delete the orphan customer row for that email from `customer` table if you want to re-register, or add a row in `customer_auth` for that customer (see schema-auth.sql for columns). |
| Registration returns 503 "JWT_SECRET not set" | `JWT_SECRET` not in environment | Set `JWT_SECRET` and restart (see "Where to set JWT_SECRET" above). |
| "Create address failed" when adding an address | `address` table missing or has different columns | Run `schema-address.sql` to create the table, or set `ADDRESS_TABLE` to your existing address table name. Check customer-service logs for the exact SQL error. |
| "cannot execute INSERT in a read-only transaction" (SQL state 25006) | DB connection is read-only (e.g. Cloud SQL **read replica**) | Connect to the **primary** instance, not a read replica. The service sets `read-only: false` and connection-init-sql to force read-write; if you still see 25006, your `SPRING_DATASOURCE_URL` (or Cloud SQL Proxy target) must point to the primary. See cart-service/docs/CLOUD_SQL_READONLY_FIX.md for how to find the primary. |
| "Invalid email or password" with correct credentials | No row in `customer_auth`, wrong password hash, or JWT_SECRET not set | Check customer-service logs: "Login: no auth row" = run schema-auth.sql and register again; "Login: password mismatch" = password may have been set by another system (use reset password or re-register); if you get 503 instead, set JWT_SECRET. Ensure the user registered via this service (so password is BCrypt in customer_auth). |

## Storefront

Set in storefront `.env.local`:

```env
CUSTOMER_SERVICE_URL=http://127.0.0.1:8087
```

Then all customer and auth (login, register, logout, password reset) use this service. Medusa is not used for customer or auth.

## Password reset email

`requestPasswordReset` stores a token in the DB; it does **not** send email. To send reset links, add an email sender (e.g. SMTP) and call it from the service after storing the token, or use a queue. The reset link should include the token (e.g. `?token=...`) so the frontend can call `update-password` with it.
