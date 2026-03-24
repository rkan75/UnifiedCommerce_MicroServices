/**
 * Optional “shop for delivery” fulfillment: after the customer sets a delivery address/ZIP,
 * show top nearby store locations as fulfillment candidates (proxy for inventory until a
 * dedicated availability API exists).
 *
 * NEXT_PUBLIC_DELIVERY_FULFILLMENT_STORE_LOOKUP — default false. When true, delivery flow
 * loads store locations and asks the customer to pick a fulfillment store.
 *
 * NEXT_PUBLIC_DELIVERY_FULFILLMENT_STORE_COUNT — how many stores to show (default 5, max 20).
 */

const COUNT_MIN = 1
const COUNT_MAX = 20

export function getDeliveryFulfillmentStoreLookupEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_DELIVERY_FULFILLMENT_STORE_LOOKUP?.trim().toLowerCase()
  return raw === "true" || raw === "1" || raw === "yes"
}

export function getDeliveryFulfillmentStoreCount(): number {
  const raw = process.env.NEXT_PUBLIC_DELIVERY_FULFILLMENT_STORE_COUNT?.trim()
  const n = raw ? parseInt(raw, 10) : 5
  if (!Number.isFinite(n)) return 5
  return Math.min(COUNT_MAX, Math.max(COUNT_MIN, n))
}
