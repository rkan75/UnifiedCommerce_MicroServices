# Admin branding (welcome text + logo)

The backend admin shows **"Welcome to TCS Unified AI Commerce"** and the **TCS logo** on the login and invite screens.

## How it works

1. **Patch** (`patches/@medusajs+dashboard+2.13.1.patch`) – Contains the invite token fix only. Applied by `patch-package` on `npm install`.
2. **Script** (`scripts/apply-admin-branding.js`) – Run after `patch-package` in `postinstall`. It:
   - Replaces "Welcome to Medusa" with "Welcome to TCS Unified AI Commerce" in the dashboard’s English translations (login + invite).
   - Replaces the Medusa logo SVG with an image that loads `/admin/logo` (your TCS logo).
3. **Logo route** – `GET /admin/logo` is implemented in `src/api/admin/logo/route.ts` and serves `public/tcslogo.png`.

## What you need

- **`public/tcslogo.png`** – Put your TCS logo file here. If it’s missing, the login/invite page will show a broken image and the route will return 404.

## After install or pull

1. Run `npm install` (postinstall will run `patch-package` and `apply-admin-branding.js`).
2. Restart the backend (e.g. `./restart-dev.sh` or `npm run dev`).
3. Hard-refresh the admin in the browser (e.g. Ctrl+Shift+R / Cmd+Shift+R) so it loads the updated dashboard bundle.

If you ever see "Welcome to Medusa" or the old logo again (e.g. after a clean `node_modules`), run:

```bash
node scripts/apply-admin-branding.js
```

Then restart the backend and refresh the admin.
