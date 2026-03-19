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

### 4. RBAC – "Insufficient permissions" (e.g. variant prices)

If you see **"Insufficient permissions. Required policies: product_variant:,update,delete"** when saving variant prices (or similar) even as **Super Admin**, the role was created without any policies. The role seed only creates role *names*; it does not attach policies.

**Fix:**

1. From the backend directory run: `npx medusa exec ./src/scripts/seed-super-admin-policies.ts` (if you haven’t already). This attaches all policies (e.g. product_variant update/delete) to the "Super Admin" role.
2. **Restart your Medusa backend** so the in-memory permission cache is cleared.
3. **Log out of the admin and log back in** so your JWT includes the Super Admin role.
4. Ensure your user is assigned the "Super Admin" role (Settings → User & Role Management → Users → [your user] → Roles).
5. Retry updating variant prices.

You can also assign policies manually in **Settings → User & Role Management → Roles → [Super Admin] → Policies**.

**Keep RBAC enabled.** Do not set `MEDUSA_FF_RBAC=false` as a workaround—it disables role-based access control and weakens security. Resolve "Insufficient permissions" by assigning the correct roles and policies (see steps above and `docs/ADMIN_UNAUTHORIZED_401.md`).

**Diagnostic:** To see which policies exist and what is attached to Super Admin, run:

```bash
npx medusa exec ./src/scripts/list-rbac-policies.ts
```

### 5. Backend logs

On GCP, check the backend (Cloud Run) logs when you click "Send Invite". The custom invite route now returns the real error message in the response; if it still fails, the logs will show the underlying exception.

## Summary

| Issue | Action |
|--------|--------|
| "Unknown error" when sending invite | Deploy the updated backend (custom `POST /admin/invites`) and admin (configurable backend URL + error message). |
| Admin on different domain than API | Set `MEDUSA_BACKEND_URL` at build or `window.__MEDUSA_BACKEND_URL__` at runtime. |
| CORS errors in browser console | Add the admin origin to `ADMIN_CORS` and `AUTH_CORS`. |
| "You do not have permission to create invites" | Give your role invite create permission in User & Role Management. |
| "Insufficient permissions" when updating variant prices (Super Admin) | Run seed-super-admin-policies script, then restart backend and log out/in so JWT and cache are updated. |
