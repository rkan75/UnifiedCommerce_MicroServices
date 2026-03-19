# Algolia search – update products and troubleshoot storefront (GCP / Cloud Run)

## Update products to Algolia (sync DB → search index)

To push your current products from the database (e.g. Cloud SQL) to the Algolia **products** index so storefront search works:

1. **Start Cloud SQL Proxy** (if your DB is on Cloud SQL):
   ```bash
   cloud-sql-proxy --port 5433 YOUR_PROJECT_ID:us-central1:medusa-db
   ```

2. **Set env vars and run the export** (from repo root):
   ```bash
   export DATABASE_URL="postgresql://medusa_app:YOUR_PASSWORD@127.0.0.1:5433/medusa_grocery_store"
   export ALGOLIA_APP_ID=your_algolia_app_id
   export ALGOLIA_ADMIN_API_KEY=your_algolia_admin_api_key
   ./deploy/run-algolia-export.sh
   ```
   Use your **Admin API key** from [Algolia Dashboard → API Keys](https://dashboard.algolia.com/), not the Search-Only key. If the password contains `@`, use `%40`.

3. The script exports products and **uploads** them to the index named **products**. After it finishes, storefront search will use the updated data (you may need to wait a few seconds).

Run this whenever you add/update/delete products and want Algolia search to reflect the changes.

### Upload only the JSON file (no database)

If you already have `data/products-for-algolia.json` and only want to push it to Algolia (no DB connection):

```bash
# From repo root
export ALGOLIA_APP_ID=your_app_id
export ALGOLIA_ADMIN_API_KEY=your_admin_api_key
./deploy/run-upload-products-json-to-algolia.sh
```

Or from `unifiedcommerce-grocery-store/`:

```bash
ALGOLIA_APP_ID=xxx ALGOLIA_ADMIN_API_KEY=yyy npx ts-node src/scripts/upload-products-json-to-algolia.ts
```

Optional env: `JSON_FILE=data/other.json`, `ALGOLIA_INDEX_NAME=products`. The script clears the index then uploads all records from the JSON in batches.

---

## Algolia search not working / no results on GCP storefront

If search on the live storefront (unifiedomnichannel.com or Cloud Run) shows no products:

### First: see what’s happening in the browser

1. Open the storefront, open **DevTools** (F12) → **Network** tab.
2. Type something in the search box (e.g. "apple").
3. Look for requests to **`algolia.net`** or **`algoliasearch.net`**:
   - **No request to Algolia** → The app is using the fallback search (Algolia env vars were not in the build). **Fix:** Rebuild and redeploy the storefront with Algolia build args (see section 1 below).
   - **Request returns 403** → The Search-Only API key is rejecting the request (usually **allowed referrers**). **Fix:** In Algolia Dashboard → API Keys → your Search-Only key → add `https://unifiedomnichannel.com/*` and your Cloud Run URL (e.g. `https://*.run.app/*`) to **Allowed referrers** (section 3 below).
   - **Request returns 200 but response has 0 hits** → Algolia is responding but the **index is empty**. **Fix:** Populate the index (section 2 below).

### If you see the fallback search (no dropdown / different UI)

The storefront was built without `NEXT_PUBLIC_ALGOLIA_APP_ID` and `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`. Rebuild with Algolia (section 1) and redeploy.

## 1. Storefront built with Algolia env vars

`NEXT_PUBLIC_ALGOLIA_*` are **baked in at build time**. If the image was built without them, the search bar will use the fallback (non-Algolia) search or show no Algolia UI.

**Fix:** Rebuild the storefront with Algolia substitutions. Defaults are in `deploy/cloudbuild.yaml`; you can override via env when running the build:

```bash
# From repo root – uses Algolia defaults from cloudbuild.yaml
./deploy/build-and-deploy-storefront.sh

# Or pass your own Algolia credentials explicitly
NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id \
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_search_only_key \
./deploy/build-and-deploy-storefront.sh
```

Then redeploy (the script deploys after build). After the new revision is live, hard-refresh the site (Ctrl+Shift+R / Cmd+Shift+R).

## 2. Algolia index is empty

The storefront queries the index name configured as `NEXT_PUBLIC_ALGOLIA_INDEX_NAME` (default: **products**). If that index has no records, search returns no results.

**Fix:** Populate the index from your Medusa database (e.g. Cloud SQL):

1. Start Cloud SQL Proxy and set `DATABASE_URL` (see `deploy/run-algolia-export.sh`).
2. Set `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY` (Admin API key, not Search-Only).
3. Run:
   ```bash
   ./deploy/run-algolia-export.sh
   ```
4. The script exports products and, if Algolia credentials are set, uploads them to the **products** index. Wait a minute, then try search again on the storefront.

## 3. Search-Only API key referrer restrictions

If your Algolia **Search-Only** API key has “Allowed referrers” set, the key will only work from those domains. Requests from your production storefront domain must be allowed.

**Fix:**

1. In [Algolia Dashboard](https://dashboard.algolia.com/) → **Settings** → **API Keys**.
2. Open the **Search-Only** key you use for `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`.
3. Under **Allowed referrers**, add:
   - `https://unifiedomnichannel.com/*`
   - Your Cloud Run storefront URL if you use it, e.g. `https://medusa-storefront-*.run.app/*`
   - For local dev: `http://localhost:*`
4. Save. Try search again on the live site.

## 4. Wrong App ID or Search-Only key

- Use the **Application ID** from the Algolia dashboard (e.g. `XXXXXXXXXX`).
- Use the **Search-Only API Key** (not the Admin API Key). It is safe to expose in the frontend.

If you use the Admin API key in the storefront, Algolia may reject requests or you may hit security restrictions. The default values in `deploy/cloudbuild.yaml` may be placeholders; if search still fails after fixing index and referrers, rebuild with your real Algolia credentials:
`NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_search_only_key ./deploy/build-and-deploy-storefront.sh`

## Quick checklist

| Check | Action |
|-------|--------|
| Storefront image built with Algolia vars | Rebuild with `./deploy/build-and-deploy-storefront.sh` (and optional env overrides), then redeploy. |
| Index has data | Run `./deploy/run-algolia-export.sh` with `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY` set. |
| Referrers allowed | Add production URL (and Cloud Run URL if needed) to the Search-Only key’s allowed referrers. |
| Using Search-Only key | Use the key from API Keys → Search-Only, not the Admin key. |
