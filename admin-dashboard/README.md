# Admin Dashboard (Java)

Java Spring Boot service that **recreates the Medusa backend dashboard** using your existing Java microservices. It serves the admin UI and proxies API calls to admin-rbac, products, regions, categories, and collections services.

## Features

- **Login** – POST `/auth/user/emailpass` (proxies to admin-rbac), sets JWT cookie
- **Session** – GET/POST `/auth/session` (validates JWT; same secret as admin-rbac)
- **Dashboard UI** – Products, Orders, Regions, Users, Invites, Settings (static SPA)
- **Admin API** – Proxies to microservices:
  - `/admin/invites`, `/admin/users`, `/admin/roles`, `/admin/policies` → admin-rbac
  - `/admin/regions` → regions-service (`/store/regions`)
  - `/admin/products`, `/admin/product-variants` → products-service
  - `/admin/product-categories` → categories-service
  - `/admin/product-collections` → collections-service
- **Protected routes** – `/app/*` and `/admin/*` require valid JWT (cookie or Bearer)

## Run

1. **Configure** (optional; defaults point to localhost):
   ```bash
   cp .env.example .env
   # Set ADMIN_RBAC_SERVICE_URL, JWT_SECRET (must match admin-rbac), and other service URLs
   ```

2. **Start admin-rbac** (required for login):
   ```bash
   cd admin-rbac-service && ./restart-dev.sh
   ```

3. **Start this dashboard**:
   ```bash
   ./restart-dev.sh
   # or: mvn spring-boot:run
   ```

4. Open **http://localhost:9010/admin-login**, sign in, then you are redirected to **http://localhost:9010/app/products**.

## Port and URLs

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | 9010 | Dashboard server port |
| `app.admin-rbac-url` | http://localhost:8088 | Admin RBAC (login, users, invites, roles) |
| `app.products-url` | http://localhost:8082 | Products service |
| `app.regions-url` | http://localhost:8084 | Regions service |
| `app.categories-url` | http://localhost:8083 | Categories service |
| `app.collections-url` | http://localhost:8085 | Collections service |
| `app.jwt-secret` | (env JWT_SECRET) | Must match admin-rbac for session validation |
| `app.cookie-name` | medusa_admin_token | Cookie name for JWT |

## Logo

Put a PNG at `src/main/resources/static/logo.png` to show on the login page. Otherwise `/admin/logo` returns 404 (login page still works).

## Replace Node store-backend

To use this Java dashboard instead of the Node `store-backend`:

1. Run admin-dashboard on port **9000** (set `SERVER_PORT=9000` or `server.port=9000`).
2. Point your browser to `http://localhost:9000/admin-login`.
3. You can keep or retire the Node store-backend; this service provides login, session, proxy APIs, and the same dashboard UI.
