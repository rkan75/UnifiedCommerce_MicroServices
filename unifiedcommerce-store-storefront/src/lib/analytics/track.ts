/**
 * Client-side GA4 tracking via our API (ad-block resilient).
 * No gtag or google-analytics.com in the browser — all events go to /api/analytics.
 */

const COOKIE_NAME = "_ga_cid"
const COOKIE_MAX_AGE_DAYS = 730 // ~2 years

function getOrCreateClientId(): string {
  if (typeof document === "undefined") return ""

  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  const existing = match ? decodeURIComponent(match[1]) : ""
  if (existing) return existing

  const newId = `cid.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 11)}`
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(newId)}; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax`
  return newId
}

export type TrackEventParams = Record<string, string | number | boolean | undefined>

/**
 * Sends one or more events to GA4 via our API (server-side Measurement Protocol).
 * Safe to call even when GA is not configured; request is no-op.
 */
export async function trackEvent(
  name: string,
  params?: TrackEventParams
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return

  const clientId = getOrCreateClientId()
  if (!clientId) return

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        events: [{ name, params }],
      }),
    })
  } catch {
    // Fire-and-forget; avoid breaking app
  }
}

/**
 * Sends a page_view event. Use in AnalyticsProvider on route change.
 */
export function trackPageView(path: string, title?: string): void {
  trackEvent("page_view", {
    page_location: typeof window !== "undefined" ? window.location.origin + path : path,
    page_title: title ?? (typeof document !== "undefined" ? document.title : ""),
  })
}
