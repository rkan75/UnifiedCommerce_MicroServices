# Unified Commerce Grocery Store — Backoffice

Standalone backoffice app for grocery operations. It talks to the **unifiedcommerce-grocery-store** (Medusa) backend APIs.

## Features

- **Order weight adjustment** — Enter actual weight for sold-by-weight line items and recalculate order totals. Uses `POST /admin/orders/:id/adjust-weight` on the backend.

## Prerequisites

- Node.js 20+
- **unifiedcommerce-grocery-store** backend running (e.g. `npm run dev` in that project, typically on port 9000).

## Setup

1. Install dependencies:
   ```bash
   cd unifiedcommerce-grocery-store-backoffice
   npm install
   ```

2. (Optional) Configure backend URL:
   - **Development:** If the backend runs on `http://localhost:9000`, you can leave env unset. The Vite dev server proxies `/admin` to the backend (see `vite.config.ts`).
   - **Production or custom backend:** Create `.env` and set:
     ```env
     VITE_MEDUSA_BACKEND_URL=http://localhost:9000
     ```
     Use the actual backend origin (no trailing slash).

3. Run the backoffice:
   ```bash
   npm run dev
   ```
   App runs at **http://localhost:7000** by default.

## Authentication

Admin API routes (e.g. `/admin/orders/:id/adjust-weight`) require an authenticated admin user. Options:

- **Cookie:** Log in to the Medusa Admin (same origin as backend, e.g. `http://localhost:9000/app`) so the `medusa_admin_token` cookie is set; then use the backoffice with the same browser (cookies are sent with `credentials: "include"` when backend URL matches or when using the proxy).
- **Same-origin proxy:** In dev, the backoffice (port 7000) proxies `/admin` to the backend (9000). Cookies for the backend are not shared across ports. So you either:
  - Set `VITE_MEDUSA_BACKEND_URL=http://localhost:9000` and open the backoffice; requests will go to 9000 and you must have logged in at 9000 (same origin as backend), or
  - Run the backoffice and backend under the same host (e.g. reverse proxy) so cookies are shared.

For local dev the simplest is: set `VITE_MEDUSA_BACKEND_URL=http://localhost:9000`, run backend and backoffice, log in at `http://localhost:9000/app`, then open `http://localhost:7000`; fetch uses the backend URL and sends cookies to 9000.

## Project structure

- `src/lib/api.ts` — API client for backend (order get, adjust-weight).
- `src/pages/OrderWeight.tsx` — Order weight adjustment page.
- `src/pages/Home.tsx` — Home / nav.
- `src/App.tsx` — Layout, router, QueryClient, Toaster.

## Build

```bash
npm run build
```

Output is in `dist/`. For production, set `VITE_MEDUSA_BACKEND_URL` to your backend URL before building.

## Docker and deploy (GCP Cloud Run)

- **Dockerfile** — Multi-stage: deps → build (with `VITE_MEDUSA_BACKEND_URL` build arg) → serve static `dist/` on port 8080.
- **Build image (from repo root):**
  ```bash
  docker build -f unifiedcommerce-grocery-store-backoffice/Dockerfile \
    --build-arg VITE_MEDUSA_BACKEND_URL=https://your-backend.run.app \
    unifiedcommerce-grocery-store-backoffice
  ```
- **Deploy (from repo root):**
  - **All services:** `./deploy/build-and-deploy-all.sh` (builds backend + storefront, deploys backend, then builds backoffice with backend URL, then deploys storefront and backoffice).
  - **Backoffice only:** Build the image with `deploy/cloudbuild-backoffice.yaml` (pass `_VITE_MEDUSA_BACKEND_URL`), then run `./deploy/deploy-backoffice.sh`. See `deploy/deploy-backoffice.sh` and `deploy/cloudbuild-backoffice.yaml` for details.

## References

- Backend API for weight adjustment: **unifiedcommerce-grocery-store** → `src/api/admin/orders/[id]/adjust-weight/route.ts`
- Design doc: **unifiedcommerce-grocery-store** → `docs/RANDOM_WEIGHT_PRODUCTS.md` (section 8 — implementation details).
