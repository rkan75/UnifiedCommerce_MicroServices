import { normalizeUsStateSearchToken } from "@lib/geolocation/us-location-query"
import { geocodeQuery } from "./geocode"

/**
 * Store location shape used by the store finder and delivery flow.
 */
export type StoreLocation = {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  lat: number
  lng: number
  phone?: string | null
  openingHours?: string | null
  countryCode?: string | null
  metadata?: Record<string, unknown> | null
  /** Straight-line miles from search / geolocation center when known */
  distanceMiles?: number
}

/** API store shape (lat/lng may be null). */
export type StoreLocationFromApi = {
  id: string
  name: string
  address: string
  address_1?: string
  city: string
  state: string
  zip: string
  country_code?: string
  lat: number | null
  lng: number | null
  phone?: string | null
  opening_hours?: string | null
  metadata?: Record<string, unknown> | null
}

export const MOCK_STORES: StoreLocation[] = [
  { id: "1", name: "Unified Commerce Store – Downtown", address: "100 Main St", city: "New York", state: "NY", zip: "10001", lat: 40.7128, lng: -74.006 },
  { id: "2", name: "Unified Commerce Store – Midtown", address: "350 5th Ave", city: "New York", state: "NY", zip: "10118", lat: 40.7484, lng: -73.9857 },
  { id: "3", name: "Unified Commerce Store – Brooklyn", address: "1 MetroTech Center", city: "Brooklyn", state: "NY", zip: "11201", lat: 40.6931, lng: -73.9866 },
  { id: "4", name: "Unified Commerce Store – Los Angeles", address: "1600 Amphitheatre Pkwy", city: "Los Angeles", state: "CA", zip: "90001", lat: 34.0522, lng: -118.2437 },
  { id: "5", name: "Unified Commerce Store – Chicago", address: "233 S Wacker Dr", city: "Chicago", state: "IL", zip: "60606", lat: 41.8781, lng: -87.6298 },
  { id: "6", name: "Unified Commerce Store – Houston", address: "1600 Smith St", city: "Houston", state: "TX", zip: "77002", lat: 29.7604, lng: -95.3698 },
  { id: "7", name: "Unified Commerce Store – Phoenix", address: "200 W Washington St", city: "Phoenix", state: "AZ", zip: "85003", lat: 33.4484, lng: -112.074 },
  { id: "8", name: "Unified Commerce Store – Miami", address: "801 Brickell Ave", city: "Miami", state: "FL", zip: "33131", lat: 25.7617, lng: -80.1918 },
]

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Returns the nearest stores within a given radius (miles) of the center point,
 * sorted by distance, limited to `limit` (default 5).
 * Only includes stores with valid lat/lng; skips stores with null coordinates.
 */
function toStoreLocation(
  s: StoreLocationFromApi & { lat: number; lng: number },
  extras?: { distanceMiles?: number }
): StoreLocation {
  return {
    id: s.id,
    name: s.name,
    address: s.address_1 ?? s.address ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    zip: s.zip ?? "",
    lat: s.lat,
    lng: s.lng,
    phone: s.phone ?? null,
    openingHours: s.opening_hours ?? null,
    countryCode: s.country_code ?? null,
    metadata: s.metadata ?? null,
    distanceMiles: extras?.distanceMiles,
  }
}

export function getNearestStoresWithinRadius(
  stores: StoreLocationFromApi[],
  centerLat: number,
  centerLng: number,
  radiusMiles: number,
  limit: number
): StoreLocation[] {
  const withDistance = stores
    .filter((s): s is StoreLocationFromApi & { lat: number; lng: number } =>
      s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng)
    )
    .map((s) => ({
      ...s,
      distance: haversineDistance(centerLat, centerLng, s.lat, s.lng),
    }))
    .filter((s) => s.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)

  return withDistance.map(({ distance, ...s }) =>
    toStoreLocation(s, { distanceMiles: distance })
  )
}

/**
 * Nearest stores by straight-line distance (no radius cap). Uses DB lat/lng only.
 */
export function getNearestStoresSortedFromApi(
  stores: StoreLocationFromApi[],
  centerLat: number,
  centerLng: number,
  limit: number
): StoreLocation[] {
  const withCoords = stores.filter(
    (s): s is StoreLocationFromApi & { lat: number; lng: number } =>
      s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng)
  )
  if (withCoords.length === 0) return []

  return [...withCoords]
    .map((s) => {
      const distance = haversineDistance(centerLat, centerLng, s.lat, s.lng)
      return {
        loc: toStoreLocation(s, { distanceMiles: distance }),
        distance,
      }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((x) => x.loc)
}

/** Match user search text to store zip / city / state / name (case-insensitive). */
export function filterStoresByLocationQuery(
  stores: StoreLocationFromApi[],
  raw: string
): StoreLocationFromApi[] {
  const trimmed = raw.trim()
  const q = trimmed.toLowerCase()
  if (!q) return []
  const zipDigits = q.replace(/\D/g, "").slice(0, 5)
  const stateAbbrev = normalizeUsStateSearchToken(trimmed)

  const words = q
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)

  return stores.filter((s) => {
    const z = (s.zip ?? "").replace(/\D/g, "").slice(0, 5)
    if (zipDigits.length === 5 && z === zipDigits) return true
    if (stateAbbrev && (s.state ?? "").toUpperCase() === stateAbbrev) return true

    const city = (s.city ?? "").toLowerCase()
    const st = (s.state ?? "").toLowerCase()
    const nm = (s.name ?? "").toLowerCase()
    const addr = (s.address_1 ?? s.address ?? "").toLowerCase()
    const zipStr = (s.zip ?? "").toLowerCase()
    const hay = `${city} ${st} ${zipStr} ${nm} ${addr}`

    if (words.length >= 2) {
      return words.every((w) => hay.includes(w))
    }

    if (city.includes(q) || city.startsWith(q)) return true
    if (st && (st === q || q.startsWith(st) || st.startsWith(q))) return true
    if (nm.includes(q)) return true
    if (addr.includes(q)) return true
    return false
  })
}

const MAX_STORE_ADDRESS_GEOCODE = 24

/**
 * When map-center geocoding fails, still show directory matches: geocode each store
 * address, sort by distance from the first resolved point, cap at `limit`.
 */
export async function buildStoreLocationsFromTextMatches(
  matched: StoreLocationFromApi[],
  limit: number
): Promise<StoreLocation[]> {
  if (!matched.length) return []

  const resolved: {
    s: StoreLocationFromApi
    lat: number
    lng: number
  }[] = []
  let calls = 0

  for (const s of matched) {
    if (calls >= MAX_STORE_ADDRESS_GEOCODE) break
    let lat = s.lat
    let lng = s.lng
    if (
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      calls += 1
      const g = await geocodeQuery(
        [s.address_1 || s.address, s.city, s.state, s.zip, "USA"]
          .filter(Boolean)
          .join(", "),
        "us"
      )
      if (!g) continue
      lat = g.lat
      lng = g.lng
    }
    resolved.push({ s, lat: lat!, lng: lng! })
  }

  if (resolved.length === 0) return []

  const anchorLat = resolved[0].lat
  const anchorLng = resolved[0].lng

  return resolved
    .map(({ s, lat, lng }) => {
      const dist = haversineDistance(anchorLat, anchorLng, lat, lng)
      return toStoreLocation(
        { ...s, lat, lng } as StoreLocationFromApi & { lat: number; lng: number },
        { distanceMiles: dist }
      )
    })
    .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))
    .slice(0, limit)
}

/** Geocode store addresses missing coords until we have enough candidates for the list limit */
const MAX_ADDRESS_GEOCODE = 18

/**
 * Resolve nearest stores for a map center: prefer API rows with lat/lng; otherwise
 * geocode addresses (Nominatim, throttled) for text-matched or listed stores.
 */
export async function resolveNearestStoresForCenter(
  stores: StoreLocationFromApi[],
  centerLat: number,
  centerLng: number,
  searchText: string,
  limit: number
): Promise<StoreLocation[]> {
  const sorted = getNearestStoresSortedFromApi(
    stores,
    centerLat,
    centerLng,
    limit
  )
  if (sorted.length > 0) return sorted

  const q = searchText.trim()
  const candidates = q
    ? filterStoresByLocationQuery(stores, q)
    : [...stores]

  const enriched: StoreLocation[] = []
  let geocodeCalls = 0

  for (const s of candidates) {
    if (enriched.length >= limit * 3) break

    let lat = s.lat
    let lng = s.lng

    if (
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      if (geocodeCalls >= MAX_ADDRESS_GEOCODE) continue
      const parts = [s.address_1 || s.address, s.city, s.state, s.zip, "USA"].filter(
        Boolean
      ) as string[]
      const geoQ = parts.join(", ").trim()
      if (!geoQ) continue
      geocodeCalls += 1
      const g = await geocodeQuery(geoQ, "us")
      if (!g) continue
      lat = g.lat
      lng = g.lng
    }

    const row = { ...s, lat: lat!, lng: lng! }
    const distance = haversineDistance(centerLat, centerLng, lat!, lng!)
    enriched.push(toStoreLocation(row, { distanceMiles: distance }))
  }

  if (enriched.length === 0) return []

  const uniq = new Map<string, StoreLocation>()
  for (const loc of enriched) {
    uniq.set(loc.id, loc)
  }

  return Array.from(uniq.values())
    .map((loc) => ({
      loc,
      distance: haversineDistance(centerLat, centerLng, loc.lat, loc.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((x) => ({
      ...x.loc,
      distanceMiles: x.distance,
    }))
}

/**
 * Legacy: nearest from mock list (no radius). Used as fallback when API returns no stores.
 */
export function getNearestStores(
  centerLat: number,
  centerLng: number,
  limit = 3
): StoreLocation[] {
  return [...MOCK_STORES]
    .map((store) => ({
      ...store,
      distance: haversineDistance(centerLat, centerLng, store.lat, store.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ distance, ...store }) => ({ ...store, distanceMiles: distance }))
}

/**
 * When `/store/store-locations` returns no rows (DB empty or API error), use demo
 * coordinates so the locator search and map still work in dev/demo.
 */
export function mockStoresAsApiFallback(): StoreLocationFromApi[] {
  return MOCK_STORES.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    address_1: s.address,
    city: s.city,
    state: s.state,
    zip: s.zip,
    country_code: "us",
    lat: s.lat,
    lng: s.lng,
    phone: null,
    opening_hours: null,
    metadata: null,
  }))
}

/** Human-readable distance for store lists and checkout pickup. */
export function formatStoreDistanceMiles(miles: number | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return ""
  if (miles < 0.1) return "< 0.1 mi"
  return `${miles.toFixed(1)} mi`
}
