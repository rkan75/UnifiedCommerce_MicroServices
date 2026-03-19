/**
 * Geocode a query (zip, city, or state) using Nominatim (OpenStreetMap).
 * Use User-Agent per Nominatim usage policy.
 */
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "UnifiedCommerceStorefront/1.0"

export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
}

export async function geocodeQuery(
  query: string,
  countryCode = "us"
): Promise<GeocodeResult | null> {
  const trimmed = (query || "").trim()
  if (!trimmed) return null

  const params = new URLSearchParams({
    q: `${trimmed}, ${countryCode.toUpperCase()}`,
    format: "json",
    limit: "1",
    addressdetails: "0",
  })

  const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  })
  if (!res.ok) return null

  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null

  const first = data[0]
  const lat = parseFloat(first.lat)
  const lng = parseFloat(first.lon)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  return {
    lat,
    lng,
    displayName: first.display_name || trimmed,
  }
}
