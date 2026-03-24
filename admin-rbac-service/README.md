# Admin RBAC Service (Spring Boot)

Java Spring Boot service that **replicates** Medusa’s admin user policy and RBAC: **roles**, **users**, **user–role assignment**, and **invites**. It uses the **same PostgreSQL database** as Medusa (`user`, `invite`, `rbac_role`, `rbac_policy`, `user_rbac_role`, and optionally `rbac_role_rbac_policy`). This is a **separate service** from **customer-service** (which handles store customers). Use this for the **backoffice / Medusa Admin** user and role management.

See **[docs/MEDUSA_RBAC_AND_JAVA_REPLICATION.md](../docs/MEDUSA_RBAC_AND_JAVA_REPLICATION.md)** for how Medusa RBAC works and why this service is separate from customer-service.

## API (Medusa-compatible)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/roles` or `/admin/rbac/roles` | List RBAC roles. Response: `{ "roles": [...] }` or array. |
| GET | `/admin/users` | List users with `rbac_roles`. Query: `offset`, `limit`. |
| GET | `/admin/users/:id` | Get user by id. Response: `{ "user": { ... } }`. |
| POST | `/admin/users/:id` | Update user (body: `email`, `first_name`, `last_name`). |
| DELETE | `/admin/users/:id` | Delete user (and user–role links). |
| POST | `/admin/users/:id/roles` | Set user roles. Body: `{ "role_ids": ["role_id_1", ...] }`. |
| GET | `/admin/invites` | List invites. Query: `offset`, `limit`. |
| POST | `/admin/invites` | Create invite. Body: `{ "email": "admin@example.com" }`. |
| GET | `/admin/policies` | List RBAC policies (if `rbac_policy` table exists). |
| **Admin auth (replaces Medusa admin login)** | | |
| POST | `/auth/user/emailpass` | Admin login. Body: `{ "email", "password" }`. Returns `{ "token" }`. |
| GET/POST | `/auth/validate` | Validate JWT (Authorization: Bearer). Returns `actor_id`, `auth_identity_id`, `actor_type`. |
| POST | `/auth/admin/register-credential` | Register password for an existing admin user (e.g. after create-admin-user or invite accept). Body: `{ "email", "password" }`. |
| GET | `/actuator/health` | Health check. |

Response shapes match the Medusa admin API. **Admin auth is fully in this service;** the store backend proxies POST `/auth/user/emailpass` here and sets the `medusa_admin_token` cookie from the returned token. Use the **same JWT secret** in this service (`ADMIN_JWT_SECRET` or `JWT_SECRET`) and in the store backend (`JWT_SECRET`) so the backend can validate the cookie.

## Database

- **Tables:** `user` (quoted in SQL if name is `user`), `invite`, `rbac_role`, `rbac_policy`, `user_rbac_role`, `rbac_role_rbac_policy`, and **`admin_credential`** (email, password_hash for admin login). Same DB as Medusa. The service creates `admin_credential` at startup if missing.
- **Configurable** via `app.rbac.*` (see application.yml). Default schema: `public`.

## Configuration

| Env / property | Description |
|----------------|-------------|
| `SERVER_PORT` | Server port (default **8088**). |
| `SPRING_DATASOURCE_URL` | JDBC URL (e.g. `jdbc:postgresql://127.0.0.1:5433/grocery_store`). |
| `RBAC_TABLE_SCHEMA` | Schema for RBAC tables (default `public`). |
| `RBAC_USER_TABLE` | User table name (default `user`; reserved in PostgreSQL, so quoted in SQL). |
| `RBAC_INVITE_TABLE` | Invite table (default `invite`). |
| `RBAC_ROLE_TABLE` | Role table (default `rbac_role`). |
| `RBAC_POLICY_TABLE` | Policy table (default `rbac_policy`). |
| `RBAC_USER_ROLE_LINK_TABLE` | User–role link table (default `user_rbac_role`). |
| `RBAC_ROLE_POLICY_LINK_TABLE` | Role–policy link table (default `rbac_role_rbac_policy`). |
| `ADMIN_JWT_SECRET` or `JWT_SECRET` | **Required for admin auth.** Must match the store backend `JWT_SECRET` so the cookie is validated. |
| `ADMIN_CREDENTIAL_TABLE` | Admin credential table (default `admin_credential`). |

## Run

```bash
cd admin-rbac-service
./restart-dev.sh
```

Service runs at `http://localhost:8088` (or `http://127.0.0.1:8088`).

## Test (Postman / curl)

```bash
# Health
curl -s http://127.0.0.1:8088/actuator/health

# Roles (must exist in DB, e.g. from Medusa seed-rbac-roles)
curl -s http://127.0.0.1:8088/admin/roles
curl -s "http://127.0.0.1:8088/admin/rbac/roles"

# Users (requires user and user_rbac_role data)
curl -s "http://127.0.0.1:8088/admin/users?offset=0&limit=20"

# Invites
curl -s "http://127.0.0.1:8088/admin/invites?offset=0&limit=10"
curl -s -X POST http://127.0.0.1:8088/admin/invites -H "Content-Type: application/json" -d '{"email":"newadmin@example.com"}'

# Policies (if rbac_policy table exists)
curl -s http://127.0.0.1:8088/admin/policies
```

## Integration with store backend / backoffice

- **Option A:** Point the Medusa store backend (or API gateway) to this service for `/admin/roles`, `/admin/users`, `/admin/users/:id`, `/admin/users/:id/roles`, `/admin/invites` by proxying those paths to `ADMIN_RBAC_SERVICE_URL` (e.g. `http://127.0.0.1:8088`).
- **Option B:** Have the backoffice call this service directly for user/role/invite management when `ADMIN_RBAC_SERVICE_URL` is set; otherwise fall back to Medusa backend.

**Admin auth:** This service **does** perform admin authentication. Set `ADMIN_RBAC_SERVICE_URL` in the store backend so POST `/auth/user/emailpass` is proxied here. Set the same `JWT_SECRET` in both so the backend can validate the cookie. New admins: run `create-admin-user.ts` with `ADMIN_RBAC_SERVICE_URL` set so the script registers the credential in this service.

### "bad SQL grammar" for admin_credential on login

If you see `PreparedStatementCallback; bad SQL grammar [SELECT ... FROM public.admin_credential ...]`, the `admin_credential` table is missing. The service creates it at startup when missing; if it still doesn't exist (e.g. DB user has no CREATE rights), create it manually:

```bash
# From repo root, with DATABASE_URL or connection details:
psql "$DATABASE_URL" -f admin-rbac-service/src/main/resources/schema-admin-credential.sql
```

Or run the SQL in your DB client:

```sql
CREATE TABLE IF NOT EXISTS public.admin_credential (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_credential_email ON public.admin_credential (LOWER(email));
```

Then restart the admin-rbac-service.

### 401 Unauthorized with correct email and password

1. **Check admin-rbac-service logs** when you try to log in. You’ll see one of:
   - `Login: no credential row for email '...'` → This email has no row in `admin_credential`. The password is only stored when you run **create-admin-user** with `ADMIN_RBAC_SERVICE_URL` set, or when you call **POST /auth/admin/register-credential**.
   - `Login: password mismatch for email '...'` → The stored hash doesn’t match the password you’re typing. Re-register the credential (same email + new password) with **POST /auth/admin/register-credential**.
   - `Login: JWT generation failed` → Set **ADMIN_JWT_SECRET** (or **JWT_SECRET**) in admin-rbac-service; you’ll then get 503 with a clear message instead of 401.

2. **Ensure the credential exists in Java**  
   If the user was created before Java admin auth (e.g. only in Medusa), there is no row in `admin_credential`. From the store backend directory run:
   ```bash
   ADMIN_RBAC_SERVICE_URL=http://localhost:8088 ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=YourPassword npm run create-admin-user
   ```
   That creates the user (if needed) and registers the password in admin-rbac-service. Or call the Java service directly to register the password for an existing user:
   ```bash
   curl -s -X POST http://localhost:8088/auth/admin/register-credential -H "Content-Type: application/json" -d '{"email":"your@email.com","password":"YourPassword"}'
   ```
   Then try logging in again.
