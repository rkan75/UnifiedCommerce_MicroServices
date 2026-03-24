import type { GeocodeResult } from "./geocode-types"

export type { GeocodeResult } from "./geocode-types"

/**
 * Geocode zip, city, or US state via our API route (server-side Nominatim).
 * Two-letter states (e.g. CA) are expanded to full names on the server to avoid Canada ambiguity.
 */
export async function geocodeQuery(
  query: string,
  countryCode = "us"
): Promise<GeocodeResult | null> {
  const trimmed = (query || "").trim()
  if (!trimmed) return null

  try {
    const params = new URLSearchParams({
      q: trimmed,
      country: countryCode,
    })
    const res = await fetch(`/api/geocode?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result: GeocodeResult | null }
    return data.result ?? null
  } catch {
    return null
  }
}

/**
 * Try several query shapes — Nominatim often fails on a bare city name but succeeds
 * with ", USA" (e.g. "cumming" vs "cumming, USA").
 */
export async function geocodeQueryWithVariants(
  raw: string,
  countryCode = "us"
): Promise<GeocodeResult | null> {
  const t = (raw || "").trim()
  if (!t) return null
  const variants = [
    t,
    `${t}, USA`,
    `${t}, United States`,
    `${t}, US`,
  ]
  const seen = new Set<string>()
  for (const v of variants) {
    if (seen.has(v)) continue
    seen.add(v)
    const g = await geocodeQuery(v, countryCode)
    if (g) return g
  }
  return null
}
