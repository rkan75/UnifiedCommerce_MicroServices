import { sendToGA4 } from "@lib/analytics/ga4-server"
import { NextRequest, NextResponse } from "next/server"

const CLIENT_ID_MAX = 128
const MAX_EVENTS = 10
const EVENT_NAME_MAX = 40

function isValidClientId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= CLIENT_ID_MAX
}

function isValidEvent(
  e: unknown
): e is { name: string; params?: Record<string, unknown> } {
  if (!e || typeof e !== "object" || !("name" in e)) return false
  const name = (e as { name: unknown }).name
  if (typeof name !== "string" || name.length === 0 || name.length > EVENT_NAME_MAX)
    return false
  if ("params" in e && (e as { params: unknown }).params !== undefined) {
    const params = (e as { params: unknown }).params
    if (typeof params !== "object" || params === null || Array.isArray(params))
      return false
  }
  return true
}

/**
 * POST /api/analytics
 * Body: { clientId: string, events: Array<{ name: string, params?: object }> }
 * Forwards to GA4 Measurement Protocol (server-side) for ad-block resilience.
 */
export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || !process.env.GA_MEASUREMENT_PROTOCOL_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Analytics not configured" },
      { status: 501 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    )
  }

  if (!body || typeof body !== "object" || !("clientId" in body) || !("events" in body)) {
    return NextResponse.json(
      { ok: false, error: "Missing clientId or events" },
      { status: 400 }
    )
  }

  const { clientId, events: rawEvents } = body as {
    clientId: unknown
    events: unknown
  }

  if (!isValidClientId(clientId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid clientId" },
      { status: 400 }
    )
  }

  if (!Array.isArray(rawEvents) || rawEvents.length === 0 || rawEvents.length > MAX_EVENTS) {
    return NextResponse.json(
      { ok: false, error: "events must be a non-empty array (max 10)" },
      { status: 400 }
    )
  }

  const events = rawEvents.filter(isValidEvent).map((e) => ({
    name: e.name,
    params: e.params as Record<string, string | number | boolean | undefined> | undefined,
  }))

  if (events.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid events" },
      { status: 400 }
    )
  }

  const result = await sendToGA4({ clientId, events })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "GA4 send failed" },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
