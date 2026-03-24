/**
 * GA4 Measurement Protocol — server-side only.
 * Sends events to Google Analytics from our API so ad-blockers (which block
 * google-analytics.com in the browser) do not affect tracking.
 */

const GA4_MP_URL = "https://www.google-analytics.com/mp/collect"

export type GA4Event = {
  name: string
  params?: Record<string, string | number | boolean | undefined>
}

export type SendToGA4Params = {
  clientId: string
  events: GA4Event[]
  /** Optional: set for EU/regional compliance (e.g. region1) */
  endpoint?: "global" | "eu"
}

/**
 * Sends events to GA4 via Measurement Protocol.
 * Only sends when GA_MEASUREMENT_PROTOCOL_SECRET and NEXT_PUBLIC_GA_MEASUREMENT_ID are set.
 */
export async function sendToGA4({
  clientId,
  events,
  endpoint = "global",
}: SendToGA4Params): Promise<{ ok: boolean; error?: string }> {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const apiSecret = process.env.GA_MEASUREMENT_PROTOCOL_SECRET

  if (!measurementId || !apiSecret) {
    return { ok: false, error: "GA4 not configured" }
  }

  if (!clientId || events.length === 0) {
    return { ok: false, error: "Missing clientId or events" }
  }

  const baseUrl =
    endpoint === "eu"
      ? "https://region1.google-analytics.com/mp/collect"
      : GA4_MP_URL

  const url = `${baseUrl}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`

  const body = {
    client_id: clientId,
    events: events.map((e) => ({
      name: e.name,
      params: e.params
        ? Object.fromEntries(
            Object.entries(e.params).filter(([, v]) => v !== undefined)
          )
        : undefined,
    })),
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `GA4 MP ${res.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
