# Admin "Unauthorized" (401) on POST (e.g. saving variant prices)

When **GET** requests work (e.g. loading product/variant) but **POST** returns **401 Unauthorized** (e.g. saving variant prices), the server is not receiving a valid auth token for that request.

## Fix applied in this project

This project uses a **cookie fallback** so admin requests work even when the dashboard does not send the `Authorization: Bearer` header:

1. **Login sets a cookie**  
   On successful login, the auth route sets a cookie `medusa_admin_token` with the JWT (see `src/api/auth/[actor_type]/[auth_provider]/route.ts`).

2. **Cookie copied to Authorization before framework auth**  
   The project’s **`src/api/middlewares.ts`** defines a middleware for `/admin*` that runs when the framework loads middlewares: it sets `Authorization: Bearer <token>` from the `medusa_admin_token` cookie when the header is missing, then sets `req.auth_context` from the JWT. This is **project code**, not a patch to `node_modules`, so it **persists across `npm install`**. No framework patch is required. If you ever need to patch a dependency, use `npx patch-package <package-name>` and add a `postinstall` script so patches are reapplied after install (see `package.json`).

**What you need to do:**

1. Restart the backend, then **log out and log back in** once so the new login sets the cookie.
2. **Use the same origin for admin and API:** Open the admin at **http://localhost:9000** (the same host/port as the API). If the admin runs on a different port (e.g. 53974), the browser may not send the cookie to 9000 unless the dashboard sends requests with credentials. Prefer opening the admin at the backend URL (e.g. http://localhost:9000/app) so all requests are same-origin and the cookie is sent automatically.
3. **Verify the cookie:** After logging in, open DevTools → Application → Cookies → http://localhost:9000. You should see `medusa_admin_token`. If it’s missing, log in again from a tab that has the backend as origin (e.g. http://localhost:9000).
4. **Debug:** If it still returns 401, set `DEBUG_ADMIN_AUTH=true` in `.env`, restart, and try again. In the backend terminal you’ll see either "Authorization header already present", "Set Authorization from medusa_admin_token cookie", or "No Authorization and no medusa_admin_token cookie" for each /admin request.

## Other fixes (if needed)

### 1. Log out and log back in
- In the admin UI, **log out** completely.
- **Log back in** with your email and password.
- Try saving the variant price again.

This refreshes your JWT; an expired or invalid token causes 401.

### 2. Use the same URL for admin every time
- Always open the admin at **one** base URL, e.g. `http://localhost:9000`.
- Avoid mixing `http://localhost:9000` and `http://127.0.0.1:9000` — cookies are per-origin, so the token may not be sent if the origin changes.

### 3. Clear site data and log in again
- In the browser: **DevTools → Application → Storage → Clear site data** (for `localhost:9000`).
- Reload and **log in again**, then retry the action.

### 4. Check that the POST sends the token
- Open **DevTools → Network**.
- Trigger the failing action (e.g. save variant price).
- Click the **POST** request that returns 401.
- In **Request Headers**, confirm either:
  - `Authorization: Bearer <token>`, or
  - A cookie that holds the session/token.

If neither is present, the admin app is not attaching auth to that POST (e.g. bug or wrong API base URL).

### 5. Backend and JWT_SECRET
- Ensure the backend was **restarted** after any change to `.env` (e.g. `JWT_SECRET`).
- If you run multiple backends, they must use the **same** `JWT_SECRET` and the admin must call the backend you’re logged in against.

## Difference from "Insufficient permissions"
- **401 Unauthorized** = request is **not authenticated** (no or invalid token).
- **403 / "Insufficient permissions"** = request **is** authenticated but the user’s role doesn’t have permission (e.g. RBAC policy).

For 401 (no message), fix auth (login, cookie, same origin). For 401 "Insufficient permissions", fix RBAC (see below).

---

## "Insufficient permissions" (401) when updating variant prices

If you see **401** with message **"Insufficient permissions. Required policies: product_variant:,update,delete"** (or similar), the request **is** authenticated but your user's **RBAC role** does not have the required policies.

**Do this (in order):**

1. **Attach all policies to the Super Admin role** (from the backend root):
   ```bash
   npx medusa exec ./src/scripts/seed-super-admin-policies.ts
   ```
2. **Restart your Medusa backend** (permission cache is in-memory).
3. **Assign yourself the Super Admin role** (if not already): Admin → **Settings** → **User Management** → your user → **Roles** → ensure **Super Admin** is selected.
4. **Log out of the admin and log back in** so the new JWT includes your roles in `app_metadata.roles`.

Then try updating the variant price again.

To confirm Super Admin has the right policies:
```bash
npx medusa exec ./src/scripts/verify-rbac-super-admin.ts
```
