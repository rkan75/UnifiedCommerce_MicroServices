import type { StoreCartShippingOption } from "@medusajs/types"
import type { StoreLocation } from "@modules/layout/components/delivery-location/store-finder-data"

/** Store API may return expanded `service_zone` / `metadata` on cart shipping options. */
export type StoreCartShippingOptionExpanded = StoreCartShippingOption & {
  metadata?: Record<string, unknown> | null
  service_zone?: {
    fulfillment_set?: {
      type?: string
      location?: { address?: { postal_code?: string | null; city?: string | null } }
    }
  } | null
}

export function isPickupShippingOption(
  opt: StoreCartShippingOption
): boolean {
  return (
    (opt as StoreCartShippingOptionExpanded).service_zone?.fulfillment_set
      ?.type === "pickup"
  )
}

/** Name / metadata hints when Medusa omits expanded `service_zone` on the client. */
const PICKUP_NAME_HINT =
  /pickup|click\s*and\s*collect|bopis|curbside|in-?store|shop\s*for\s*pickup|store\s*pickup|collect\s*at\s*store/i

function isPickupByMetadata(opt: StoreCartShippingOption): boolean {
  const m = (opt as StoreCartShippingOptionExpanded).metadata as
    | Record<string, unknown>
    | null
    | undefined
  if (!m || typeof m !== "object") return false
  const t = m.fulfillment_type ?? m.type ?? m.shipping_type
  if (t === "pickup" || m.is_pickup === true) return true
  return false
}

/** Prefer API `service_zone` type; fall back to name / metadata when relations are not expanded. */
export function filterPickupShippingOptions(
  options: StoreCartShippingOption[] | null | undefined
): StoreCartShippingOption[] {
  if (!options?.length) return []
  const byZone = options.filter(isPickupShippingOption)
  if (byZone.length) return byZone
  const byName = options.filter((o) => PICKUP_NAME_HINT.test((o.name ?? "").trim()))
  if (byName.length) return byName
  const byMeta = options.filter(isPickupByMetadata)
  return byMeta
}

/** Typical home-delivery-only labels (exclude when inferring pickup). */
const HOME_DELIVERY_NAME_HINT =
  /^(standard|express|economy|overnight|ground|home|door|delivery|shipping|same[\s-]?day|two[\s-]?day|next[\s-]?day|flat|fixed|dynamic)/i

export type ResolvePickupOptionsResult = {
  pickupOptions: StoreCartShippingOption[]
  /** True when we inferred pickup from naming (not explicit zone/type). */
  inferred: boolean
}

/**
 * Resolves which shipping options serve store pickup for this cart.
 * Many setups expose a single "Pickup" option for all stores — we infer it when Medusa omits relations.
 */
export function resolvePickupOptionsForLocator(
  all: StoreCartShippingOption[] | null | undefined
): ResolvePickupOptionsResult {
  const list = all ?? []
  const direct = filterPickupShippingOptions(list)
  if (direct.length) return { pickupOptions: direct, inferred: false }
  if (!list.length) return { pickupOptions: [], inferred: false }

  const pickupNamed = list.filter((o) =>
    PICKUP_NAME_HINT.test((o.name ?? "").trim())
  )
  if (pickupNamed.length) return { pickupOptions: pickupNamed, inferred: true }

  const nonHome = list.filter(
    (o) => !HOME_DELIVERY_NAME_HINT.test((o.name ?? "").trim())
  )
  if (nonHome.length === 1) return { pickupOptions: nonHome, inferred: true }

  return { pickupOptions: [], inferred: false }
}

/**
 * Map a store-locator row to the Medusa pickup shipping option for that location.
 */
export function matchPickupShippingOption(
  store: StoreLocation,
  options: StoreCartShippingOption[]
): StoreCartShippingOption | null {
  if (!options?.length) return null

  if (options.length === 1) {
    return options[0]
  }

  for (const opt of options) {
    const o = opt as StoreCartShippingOptionExpanded
    const meta = o.metadata as Record<string, unknown> | undefined
    const sid = meta?.store_location_id ?? meta?.store_id
    if (sid != null && String(sid) === String(store.id)) {
      return opt
    }
  }

  const zipDigits = (store.zip ?? "").replace(/\D/g, "").slice(0, 5)
  for (const opt of options) {
    const addr = (opt as StoreCartShippingOptionExpanded).service_zone
      ?.fulfillment_set?.location?.address
    if (!addr) continue
    const oz = (addr.postal_code ?? "").replace(/\D/g, "").slice(0, 5)
    if (zipDigits.length === 5 && oz && oz === zipDigits) {
      return opt
    }
  }

  const sn = (store.name ?? "").toLowerCase().trim()
  for (const opt of options) {
    const on = (opt.name ?? "").toLowerCase().trim()
    if (sn && on && (on.includes(sn.slice(0, Math.min(20, sn.length))) || sn.includes(on.slice(0, 16)))) {
      return opt
    }
  }

  const city = (store.city ?? "").toLowerCase().trim()
  for (const opt of options) {
    const addr = (opt as StoreCartShippingOptionExpanded).service_zone
      ?.fulfillment_set?.location?.address
    const c = (addr?.city ?? "").toLowerCase().trim()
    if (city && c && city === c) {
      return opt
    }
  }

  return options[0] ?? null
}
