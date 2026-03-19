# Google Analytics 4 (ad-block resilient)

Events are sent to GA4 **from your server** via the [Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4), so ad-blockers that block `google-analytics.com` in the browser do not block tracking.

## Setup

1. In [Google Analytics 4](https://analytics.google.com/): **Admin** → **Data streams** → select your web stream (or create one).
2. Open **Measurement Protocol API secrets** and **Create**.
3. Add to `.env.local`:

   ```env
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   GA_MEASUREMENT_PROTOCOL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. Restart the dev server. Page views are tracked automatically on navigation.

## How it works

- The browser never loads `gtag.js` or talks to `google-analytics.com` directly.
- The client sends events to your own API: `POST /api/analytics` with `clientId` and `events`.
- The API forwards requests to GA4’s Measurement Protocol. Ad-blockers don’t block your domain.

## Custom events

Use the `trackEvent` helper for GA4 recommended events or custom events:

```ts
import { trackEvent } from "@lib/analytics/track"

// Recommended ecommerce events
trackEvent("view_item", { item_id: product.id, item_name: product.title })
trackEvent("add_to_cart", { items: [...], value: 19.99, currency: "USD" })
trackEvent("begin_checkout", { value: 49.99, currency: "USD" })
trackEvent("purchase", { transaction_id: order.id, value: 99.99, currency: "USD" })

// Custom event
trackEvent("recipe_view", { recipe_slug: "peanut-butter-wrap" })
```

Parameter names and values must be strings, numbers, or booleans. Events are fire-and-forget and do not throw.

## EU / region-specific endpoint

To send data to the EU endpoint (e.g. for compliance), you can extend `sendToGA4` in `src/lib/analytics/ga4-server.ts` to pass `endpoint: "eu"` when an env (e.g. `GA4_USE_EU_ENDPOINT=true`) is set.
