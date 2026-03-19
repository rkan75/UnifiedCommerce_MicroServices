# Price Changes During the Day & Immediate Reflection

Medusa **does** accept price changes at any time. When you update a product or variant price in Medusa Admin, the Store API returns the new `calculated_price` on the next request. The delay customers see is from the **storefront cache**, not Medusa.

This doc explains how to get price changes (and other catalog updates) to reflect on the site quickly or immediately.

---

## 1. How Medusa Handles Price Changes

- **Admin:** You change a variant price (or use price lists, promotions) in Medusa Admin.
- **Backend:** Medusa stores the update and serves the new `calculated_price` from the Store API immediately. There is no server-side cache that blocks price updates.
- **Storefront:** The Next.js app caches product data (for performance). Until that cache is invalidated or expires, visitors may see old prices.

So: **Medusa accepts and serves price changes immediately.** To have the storefront show them immediately, you need to invalidate the storefront cache.

---

## 2. Immediate Reflection: On-Demand Revalidation

For **data corrections** or **emergency price changes** that must appear right away:

1. **Set a secret** (e.g. in `.env`):
   ```bash
   REVALIDATE_SECRET=your-secure-random-string
   ```

2. **After updating prices in Medusa Admin**, call the revalidate API:
   ```bash
   curl -X POST "https://your-storefront.com/api/revalidate" \
     -H "Authorization: Bearer your-secure-random-string"
   ```
   Or with query (prefer header in production):
   ```bash
   curl -X POST "https://your-storefront.com/api/revalidate?secret=your-secure-random-string"
   ```

3. The next time a customer loads a product or listing page, the app will fetch fresh data from Medusa and show the new prices.

**Optional:** From Medusa backend you can call this endpoint when a product/variant is updated (e.g. in a subscriber or webhook) so revalidation happens automatically after every price change.

---

## 3. Time-Based Refresh (No API Call)

Product list data is revalidated automatically after **60 seconds** by default. So even if you never call `/api/revalidate`, price changes will appear within about a minute.

You can change the interval with an env var:

```bash
# Revalidate product cache every 30 seconds (faster updates, more backend traffic)
NEXT_PRODUCTS_REVALIDATE_SECONDS=30
```

Leave unset to use the default (60 seconds).

---

## 4. Summary

| Goal | Approach |
|------|----------|
| **Immediate** (right after an admin change) | Call `POST /api/revalidate` with `REVALIDATE_SECRET` after updating prices. |
| **Within ~1 minute** (no extra step) | Rely on default 60s revalidation. |
| **Faster automatic refresh** | Set `NEXT_PRODUCTS_REVALIDATE_SECONDS=30` (or lower). |

Medusa accepts price changes at any time; the storefront is what you tune for when those changes become visible to customers.

---

## 5. Backend: Variant Price Persistence (Admin Save)

If changing a variant price in Admin and saving **appears** to succeed but the new price does not persist in the system, the backend has been customized so that:

- **POST** ` /admin/products/:id/variants/:variant_id` runs a normalizer that converts price amounts to **cents** (smallest currency unit) when the value looks like major units (e.g. `9.99` → `999`). Medusa’s Pricing module expects amounts in cents; if the admin sends dollars, the stored value would be wrong.
- The same route still uses `updateProductVariantsWorkflow`, so variant and price-set updates are unchanged aside from this normalization.

This lives in the **backend** repo: `src/api/admin/products/[id]/variants/[variant_id]/route.ts` and `src/api/utils/normalize-variant-prices.ts`. After a price change in Admin, the storefront will show it after revalidation (see sections 2–4 above).
