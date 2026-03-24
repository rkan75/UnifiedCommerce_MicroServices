import { expandUsLocationQuery, toNominatimQuery } from "@lib/geolocation/us-location-query"
import { NextRequest, NextResponse } from "next/server"

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search"

export const dynamic = "force-dynamic"

type GeocodePayload = {
  result: {
    lat: number
    lng: number
    displayName: string
    postcode?: string
  } | null
}

/**
 * Server-side Nominatim proxy (browser calls fail CORS / User-Agent limits on direct OSM requests).
 */
export async function GET(req: NextRequest): Promise<NextResponse<GeocodePayload>> {
  const raw = req.nextUrl.searchParams.get("q")?.trim()
  const country = req.nextUrl.searchParams.get("country")?.trim() || "us"

  if (!raw) {
    return NextResponse.json({ result: null }, { status: 400 })
  }

  const expanded = expandUsLocationQuery(raw)
  const q = toNominatimQuery(expanded, country)

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    addressdetails: "1",
  })

  try {
    const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
      headers: {
        "User-Agent": "UnifiedCommerceStorefront/1.0 (https://github.com/medusajs; store locator)",
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.json({ result: null })
    }

    const data: unknown = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ result: null })
    }

    const first = data[0] as {
      lat?: string
      lon?: string
      display_name?: string
      address?: Record<string, string>
    }
    const lat = parseFloat(first.lat ?? "")
    const lng = parseFloat(first.lon ?? "")
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ result: null })
    }

    const addr = first.address
    const postcode =
      typeof addr?.postcode === "string" ? addr.postcode.split("-")[0]?.trim() : undefined

    return NextResponse.json({
      result: {
        lat,
        lng,
        displayName: first.display_name || q,
        postcode: postcode || undefined,
      },
    })
  } catch {
    return NextResponse.json({ result: null })
  }
}
