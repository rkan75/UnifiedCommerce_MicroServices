/**
 * Store locator (Delivering to / Select Store) — result count and optional distance labels.
 *
 * - NEXT_PUBLIC_STORE_LOCATOR_NEAREST_COUNT — max stores to return (nearest-first). Default 5.
 * - NEXT_PUBLIC_STORE_LOCATOR_SHOW_DISTANCE_MILES — set "true" to show straight-line miles in the
 *   list and store details. Default: hidden (nearest order only, no mileage shown).
 * - NEXT_PUBLIC_STORE_LOCATOR_DISTANCE_DECIMALS — decimal places when miles are shown (0–4). Default 2.
 */

const NEAREST_MIN = 1
const NEAREST_MAX = 100

export function getStoreLocatorNearestCount(): number {
  const raw = process.env.NEXT_PUBLIC_STORE_LOCATOR_NEAREST_COUNT?.trim()
  const n = raw ? parseInt(raw, 10) : 5
  if (!Number.isFinite(n)) return 5
  return Math.min(NEAREST_MAX, Math.max(NEAREST_MIN, n))
}

export function getStoreLocatorShowDistanceMiles(): boolean {
  const raw = process.env.NEXT_PUBLIC_STORE_LOCATOR_SHOW_DISTANCE_MILES?.trim().toLowerCase()
  if (!raw) return false
  return raw === "1" || raw === "true" || raw === "yes"
}

export function getStoreLocatorDistanceDecimals(): number {
  const raw = process.env.NEXT_PUBLIC_STORE_LOCATOR_DISTANCE_DECIMALS?.trim()
  const n = raw ? parseInt(raw, 10) : 2
  if (!Number.isFinite(n)) return 2
  return Math.min(4, Math.max(0, n))
}

export function formatStoreDistanceMiles(miles: number | null | undefined): string | null {
  if (!getStoreLocatorShowDistanceMiles()) return null
  if (miles == null || !Number.isFinite(miles)) return null
  const d = getStoreLocatorDistanceDecimals()
  return `${miles.toFixed(d)} mi`
}

/** Same as list label, with clarifier for the details sheet. */
export function formatStoreDistanceMilesDetail(miles: number | null | undefined): string | null {
  const s = formatStoreDistanceMiles(miles)
  return s ? `${s} (straight line)` : null
}
