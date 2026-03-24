import type { HttpTypes } from "@medusajs/types"

/**
 * Cart / order line item metadata for Subscribe & Save.
 * Backend jobs (Medusa subscribers, OMS) can read these on completed orders to schedule refills.
 */
export const SUBSCRIBE_AND_SAVE_META_KEY = "subscribe_and_save"
export const SHIP_EVERY_DAYS_META_KEY = "ship_every_days"

/** Customer metadata: cancelled Subscribe & Save per variant + cadence (`variantId:days` → true). */
export const SUBSCRIBE_SAVE_OPT_OUT_META_KEY = "subscribe_save_opt_out"

export function subscribeSaveOptOutKey(
  variantId: string,
  shipEveryDays: string
): string {
  return `${variantId}:${shipEveryDays}`
}

export function parseSubscribeSaveOptOutKeys(
  metadata: Record<string, unknown> | null | undefined
): Set<string> {
  if (!metadata) return new Set()
  const raw = metadata[SUBSCRIBE_SAVE_OPT_OUT_META_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Set()
  const out = new Set<string>()
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true || v === "true") out.add(k)
  }
  return out
}

export function isSubscribeSaveOptedOut(
  optOutKeys: Set<string>,
  variantId: string | null | undefined,
  shipEveryDays: string
): boolean {
  if (!variantId) return false
  return optOutKeys.has(subscribeSaveOptOutKey(variantId, shipEveryDays))
}

/** String boolean for JSON-safe cart metadata. */
export const SUBSCRIBE_TRUE = "true"
export const SHIP_EVERY_OPTIONS_DAYS = ["30", "45", "60", "90"] as const
export type ShipEveryDays = (typeof SHIP_EVERY_OPTIONS_DAYS)[number]

export const DEFAULT_SHIP_EVERY_DAYS: ShipEveryDays = "45"

/** Only set when Subscribe & Save is checked — keeps one-time lines free of subscription keys. */
export function buildSubscribeSaveLineMetadata(
  enabled: boolean,
  shipEveryDays: string
): Record<string, unknown> | undefined {
  if (!enabled) return undefined
  const days = SHIP_EVERY_OPTIONS_DAYS.includes(shipEveryDays as ShipEveryDays)
    ? shipEveryDays
    : DEFAULT_SHIP_EVERY_DAYS
  return {
    [SUBSCRIBE_AND_SAVE_META_KEY]: SUBSCRIBE_TRUE,
    [SHIP_EVERY_DAYS_META_KEY]: days,
  }
}

export function parseSubscribeSaveFromLineMetadata(
  metadata: Record<string, unknown> | null | undefined
): { enabled: boolean; shipEveryDays: string } | null {
  if (!metadata) return null
  const raw = metadata[SUBSCRIBE_AND_SAVE_META_KEY]
  const enabled = raw === true || raw === SUBSCRIBE_TRUE
  if (!enabled) return null
  const days = metadata[SHIP_EVERY_DAYS_META_KEY]
  const shipEveryDays =
    typeof days === "string" && SHIP_EVERY_OPTIONS_DAYS.includes(days as ShipEveryDays)
      ? days
      : DEFAULT_SHIP_EVERY_DAYS
  return { enabled: true, shipEveryDays }
}

/**
 * Merge subscription keys into existing line metadata (or remove them when disabled).
 */
export function mergeSubscribeSaveIntoLineMetadata(
  previous: Record<string, unknown> | null | undefined,
  enabled: boolean,
  shipEveryDays: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(previous ?? {}) }
  if (!enabled) {
    delete next[SUBSCRIBE_AND_SAVE_META_KEY]
    delete next[SHIP_EVERY_DAYS_META_KEY]
    return next
  }
  const days = SHIP_EVERY_OPTIONS_DAYS.includes(shipEveryDays as ShipEveryDays)
    ? shipEveryDays
    : DEFAULT_SHIP_EVERY_DAYS
  next[SUBSCRIBE_AND_SAVE_META_KEY] = SUBSCRIBE_TRUE
  next[SHIP_EVERY_DAYS_META_KEY] = days
  return next
}

/** Same rule as PDP: opt out with product `metadata.subscribe_eligible` = false. */
export function isProductSubscribeEligible(
  product: HttpTypes.StoreProduct | null | undefined
): boolean {
  if (!product || (product as { is_giftcard?: boolean }).is_giftcard) return false
  const v = (product.metadata as Record<string, unknown> | undefined)?.subscribe_eligible
  if (v === false || v === "false") return false
  return true
}
