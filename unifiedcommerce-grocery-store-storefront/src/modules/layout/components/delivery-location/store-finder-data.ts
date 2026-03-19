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
  lat: number | null
  lng: number | null
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

  return withDistance.map(({ distance: _d, ...s }) => ({
    id: s.id,
    name: s.name,
    address: s.address_1 ?? s.address ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    zip: s.zip ?? "",
    lat: s.lat,
    lng: s.lng,
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
    .map(({ distance, ...store }) => store)
}
