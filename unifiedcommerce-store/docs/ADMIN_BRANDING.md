# Admin dashboard branding

The backend admin can show a custom **welcome title** and **logo** on the login and invite screens.

## What runs automatically

On **`npm install`**, `postinstall` runs **`scripts/apply-admin-branding.js`**, which:

1. **Welcome text** — Replaces `"Welcome to Medusa"` with **"Welcome to GNC"** in the dashboard’s English translations (login + invite), if still at the default.
2. **Logo** — Replaces the Medusa logo SVG with an image that loads `/admin/logo` (your store logo file).
3. **Invite accept** — Normalizes `auth_token` when register returns `{ token }` (avoids `Bearer [object Object]`).

## Logo file

- **Logo route** — `GET /admin/logo` is implemented in `src/api/admin/logo/route.ts` and serves **`public/store-logo.png`**.
- **`public/store-logo.png`** — Put your logo file here (Medusa backend project root). If it’s missing, the login/invite page may show a broken image and the route will return 404.

After changing branding, restart the Medusa backend.
