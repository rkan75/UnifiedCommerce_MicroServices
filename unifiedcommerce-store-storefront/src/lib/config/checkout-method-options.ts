/**
 * Checkout "Where Else" modal: optional third tile "Shop in Store (Create a list)".
 *
 * NEXT_PUBLIC_CHECKOUT_SHOP_IN_STORE_LIST_ENABLED — when "true" / "1" / "yes", the
 * in-store list option is shown alongside delivery and pickup. Otherwise only
 * delivery and pickup are shown.
 */

export function getCheckoutShopInStoreListEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_CHECKOUT_SHOP_IN_STORE_LIST_ENABLED?.trim().toLowerCase()
  return raw === "true" || raw === "1" || raw === "yes"
}

/** Persists header fulfillment label when choosing from the "Where Else" modal outside checkout. */
export const HEADER_FULFILLMENT_STORAGE_KEY = "uc_header_fulfillment"

/** Non-httpOnly cookie so server components can align cart/checkout with the same mode as localStorage. */
export const HEADER_FULFILLMENT_COOKIE = "uc_header_fulfillment"

export const HEADER_FULFILLMENT_CHANGED_EVENT = "uc-header-fulfillment-changed"

export type HeaderFulfillmentPreference = "delivery" | "in_store" | "pickup"

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function setClientFulfillmentCookie(value: HeaderFulfillmentPreference) {
  if (typeof document === "undefined") return
  document.cookie = `${HEADER_FULFILLMENT_COOKIE}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`
}

let storageCookieSynced = false

/** One-time: mirror localStorage into cookie so the next SSR request sees the user’s mode. */
export function ensureHeaderFulfillmentCookieSyncedWithStorage() {
  if (typeof window === "undefined" || storageCookieSynced) return
  storageCookieSynced = true
  setClientFulfillmentCookie(readHeaderFulfillmentPreference())
}

export function readHeaderFulfillmentPreference(): HeaderFulfillmentPreference {
  if (typeof window === "undefined") return "delivery"
  const v = localStorage.getItem(HEADER_FULFILLMENT_STORAGE_KEY)
  if (v === "in_store" || v === "pickup" || v === "delivery") return v
  return "delivery"
}

export function writeHeaderFulfillmentPreference(
  value: HeaderFulfillmentPreference
) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(HEADER_FULFILLMENT_STORAGE_KEY, value)
  } catch {
    /* private mode / quota */
  }
  setClientFulfillmentCookie(value)
  try {
    window.dispatchEvent(new CustomEvent(HEADER_FULFILLMENT_CHANGED_EVENT))
  } catch {
    /* SSR */
  }
}
