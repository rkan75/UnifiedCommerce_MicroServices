# User & Role Management on GCP (Unknown Error Fix)

If **User & Role Management** in the admin shows an "unknown error" when sending an invite (especially on GCP Cloud Run or similar), use the following.

## What was fixed

1. **Backend** – `POST /admin/invites` is overridden so that:
   - Duplicate invite / already-registered → clear message instead of "unknown error".
   - Missing permission (RBAC) → "You do not have permission to create invites...".
   - Invalid data → validation message.
   - Any other failure → the real error message is returned instead of a generic one.

2. **Admin UI** – The User Management page now:
   - Uses a **configurable backend URL** when the admin is on a different origin than the API (e.g. on GCP).
   - Shows a clearer message on failure (including a hint to check CORS and backend URL when the request fails).

## GCP checklist

### 1. Backend URL (if admin and API are different origins)

If the admin UI is served from a different URL than the API (e.g. admin on `https://admin-xxx.run.app` and API on `https://api-xxx.run.app`):

- **Build time:** Set `MEDUSA_BACKEND_URL` when building the backend/admin so the admin bundle points to the API:
  ```bash
  MEDUSA_BACKEND_URL=https://api-xxx.run.app npx medusa build
  ```
- **Runtime:** Or inject the backend URL in the HTML that loads the admin, e.g.:
  ```html
  <script>window.__MEDUSA_BACKEND_URL__ = 'https://api-xxx.run.app';</script>
  ```

If the admin and API are served by the **same** Medusa app (same origin), you do not need to set this.

### 2. CORS

Backend `.env` (or GCP env vars) must allow the admin origin:

```env
ADMIN_CORS=https://admin-xxx.run.app,https://your-admin-domain.com
AUTH_CORS=https://admin-xxx.run.app,https://your-admin-domain.com
```

Use the exact URL users use to open the admin (including `https://`).

### 3. RBAC (invite permission)

If `MEDUSA_FF_RBAC=true`, the logged-in user must have **invite create** permission.

- In **Settings → User & Role Management**, open the role assigned to your user.
- Ensure the role has permission to **create** invites (or use an Admin role that includes it).
- If the user’s role cannot create invites, the API will return a clear "You do not have permission to create invites" message.

### 4. RBAC – "Insufficient permissions" (variant prices, **product types**, etc.)

If you see **"Insufficient permissions"** when saving variant prices, **creating a product type**, or other admin actions even as **Super Admin**, the role was created without any (or not all) policies. The role seed only creates role *names*; it does not attach policies.

Examples of messages:

- `Required policies: product_variant:,update,delete` when saving variant prices.
- A similar message naming **`product_type`** (or `create`) when creating a product type in **Settings → Product Types** (or the product type modal).

**Fix:**

1. From the backend directory run: `npx medusa exec ./src/scripts/seed-super-admin-policies.ts` (if you haven’t already). This attaches all policies (e.g. product_variant update/delete) to the "Super Admin" role.
2. **Restart your Medusa backend** so the in-memory permission cache is cleared.
3. **Log out of the admin and log back in** so your JWT includes the Super Admin role.
4. Ensure your user is assigned the "Super Admin" role (Settings → User & Role Management → Users → [your user] → Roles).
5. Retry the action (variant price, product type create, etc.).

**Re-run after upgrades:** New Medusa versions can register new RBAC resources. If something worked before and breaks after an upgrade, run `seed-super-admin-policies.ts` again so **Super Admin** picks up any new policies.

### 4a. Pickup regions / fulfillment sets — `fulfillment_set:create`, `service_zone:create`

When **creating a pickup region** or **service zones** (under **Settings → Locations & shipping**), the admin calls fulfillment-set APIs. You may see **Insufficient permissions. Required policies: fulfillment_set:create, service_zone:create** (or similar).

**Cause in Medusa 2.13.x:** Core RBAC registers policies for **`fulfillment_set`** in `policies/shipping.js`, but **not** for **`service_zone`**. Those `service_zone:*` rows never sync into `rbac_policy`, so **no user** can satisfy `service_zone:create` / `read` / `update` / `delete` checks — seeding Super Admin cannot fix it.

**Fix in this repo:** `patches/@medusajs+medusa+2.13.1.patch` adjusts `dist/api/admin/fulfillment-sets/middlewares.js` so route checks use **`fulfillment_set`** permissions only (read/update), which *are* registered and seeded. Ensure **`npm install`** runs **`postinstall`** (`patch-package`). Then restart the backend.

You should still run **`npx medusa exec ./src/scripts/seed-super-admin-policies.ts`** so **Super Admin** has **`fulfillment_set`** operations (`read`, `update`, …), and assign that role to your admin user. Log out and back in after policy changes.

**Keep RBAC enabled.** Do not set `MEDUSA_FF_RBAC=false` as a workaround—it disables role-based access control and weakens security. Resolve "Insufficient permissions" by assigning the correct roles and policies (see steps above and `docs/ADMIN_UNAUTHORIZED_401.md`).

**Diagnostic:** To see which policies exist and what is attached to Super Admin, run:

```bash
npx medusa exec ./src/scripts/list-rbac-policies.ts
```

### 4b. `product_type:undefined` or cannot create product types

If the toast shows **`Insufficient permissions. Required policies: product_type:undefined`**, Medusa’s **POST `/admin/product-types`** middleware was checking **`PolicyOperation.create`**, but **`create`** was not registered on `PolicyOperation` in `@medusajs/utils` 2.12.x (only `read`, `write`, `update`, `delete`, `*`), so the required operation became **`undefined`**.

**Fixes in this repo (both apply on `npm install` via `patch-package`):**

1. **`patches/@medusajs+utils+2.12.6.patch`** — adds **`create`** to default `PolicyOperation` values (helps all routes that use `PolicyOperation.create`).
2. **`patches/@medusajs+medusa+2.13.1.patch`** — for **create product type** only, requires **`product_type` + `write`** instead of `create`. That matches the **`WriteProductType`** policy that has always been synced for `product_type`, so it works even if older DB rows never had a `create` policy.

**`patch-package` is a runtime dependency** so production/Docker installs still apply patches (not only dev installs).

After pulling updates:

1. From `unifiedcommerce-store`: **`npm install`** (must finish `postinstall`: `patch-package` + `apply-admin-branding.js`).
2. **Restart** the backend (full restart, not only admin refresh).
3. Run **`npx medusa exec ./src/scripts/seed-super-admin-policies.ts`** if Super Admin was created before RBAC policies were complete.
4. **Log out** of the admin and **log back in**.

**Docker / Cloud Run:** Ensure the image runs **`npm install`** (or `npm ci`) **with** `postinstall` scripts enabled, so patches are applied. Do not use a `node_modules` layer built without `patch-package` having run.

### 5. Backend logs

On GCP, check the backend (Cloud Run) logs when you click "Send Invite". The custom invite route now returns the real error message in the response; if it still fails, the logs will show the underlying exception.

## Summary

| Issue | Action |
|--------|--------|
| "Unknown error" when sending invite | Deploy the updated backend (custom `POST /admin/invites`) and admin (configurable backend URL + error message). |
| Admin on different domain than API | Set `MEDUSA_BACKEND_URL` at build or `window.__MEDUSA_BACKEND_URL__` at runtime. |
| CORS errors in browser console | Add the admin origin to `ADMIN_CORS` and `AUTH_CORS`. |
| "You do not have permission to create invites" | Give your role invite create permission in User & Role Management. |
| "Insufficient permissions" (Super Admin): variant prices, product types, … | Run `seed-super-admin-policies.ts`, restart backend, log out/in. Re-run the script after Medusa upgrades if new policies appear. |
| `fulfillment_set:create` / `service_zone:create` (pickup region, service zones) | **`service_zone` RBAC rows are missing in core Medusa** — use the fulfillment-sets patch in `patches/@medusajs+medusa+2.13.1.patch` (`patch-package`), then `seed-super-admin-policies`, restart, log out/in. See §4a. |
