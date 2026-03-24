import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { ensureUcSubscriptionStateTable, getUcSubscriptionState } from "./uc-subscription-state-pg"

/** Mirrors storefront `subscribe-save-metadata` keys. */
const SUBSCRIBE_AND_SAVE = "subscribe_and_save"
const SHIP_EVERY_DAYS = "ship_every_days"
const SUBSCRIBE_TRUE = "true"
const ALLOWED_DAYS = new Set(["30", "45", "60", "90"])

type StoreSubscriptionItem = {
  id: string
  variant_id: string
  product_id?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
}

type StoreSubscription = {
  id: string
  status: "draft" | "active" | "paused" | "past_due" | "cancelled"
  interval_unit: "day"
  interval_count: number
  currency_code: string
  next_run_at: string | null
  last_run_at?: string | null
  items: StoreSubscriptionItem[]
  payment?: { label?: string | null } | null
  shipping?: {
    label?: string | null
    city?: string | null
    country_code?: string | null
    postal_code?: string | null
  } | null
  metadata?: Record<string, unknown> | null
}

function mergeMetadata(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return {
    ...(a && typeof a === "object" ? a : {}),
    ...(b && typeof b === "object" ? b : {}),
  }
}

function parseSubscribeDays(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  if (!metadata) return null
  const raw = metadata[SUBSCRIBE_AND_SAVE]
  const enabled = raw === true || raw === SUBSCRIBE_TRUE
  if (!enabled) return null
  const daysVal = metadata[SHIP_EVERY_DAYS]
  const s = typeof daysVal === "string" ? daysVal : String(daysVal ?? "")
  if (!ALLOWED_DAYS.has(s)) return null
  return parseInt(s, 10)
}

function addDaysUtc(d: Date, days: number): Date {
  const t = new Date(d.getTime())
  t.setUTCDate(t.getUTCDate() + days)
  return t
}

function orderAnchorDate(order: Record<string, unknown>): Date {
  const c = order.completed_at
  const cr = order.created_at
  if (c && (typeof c === "string" || c instanceof Date)) {
    const d = new Date(c as string | Date)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (cr && (typeof cr === "string" || cr instanceof Date)) {
    const d = new Date(cr as string | Date)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function shippingFromOrderAddress(addr: Record<string, unknown> | null | undefined) {
  if (!addr || typeof addr !== "object") return null
  const fn = (addr.first_name as string) ?? ""
  const ln = (addr.last_name as string) ?? ""
  const name = `${fn} ${ln}`.trim()
  const line = (addr.address_1 as string) ?? ""
  const label = name || line || null
  return {
    label,
    city: (addr.city as string) ?? null,
    country_code: (addr.country_code as string) ?? null,
    postal_code: (addr.postal_code as string) ?? null,
  }
}

function toQuantity(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return Math.max(1, Math.floor(n))
  if (typeof n === "string" && n.trim()) {
    const v = parseInt(n, 10)
    if (Number.isFinite(v)) return Math.max(1, v)
  }
  if (n && typeof n === "object" && "numeric" in (n as object)) {
    const num = Number((n as { numeric?: string }).numeric)
    if (Number.isFinite(num)) return Math.max(1, Math.floor(num))
  }
  return 1
}

function dedupeKey(variantId: string | null | undefined, days: number): string {
  return `${variantId ?? "unknown"}|${days}`
}

function coerceNextRunAt(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : value.toISOString()
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

async function mergePersistedOsub(
  sub: StoreSubscription
): Promise<StoreSubscription | null> {
  if (!sub.id.startsWith("osub_")) return sub
  try {
    await ensureUcSubscriptionStateTable()
  } catch {
    return sub
  }
  try {
    const row = await getUcSubscriptionState(sub.id)
    if (!row) return sub
    if (row.status === "cancelled") return null
    if (row.status === "paused") {
      return {
        ...sub,
        status: "paused",
        next_run_at: null,
      }
    }
    const persistedNext = coerceNextRunAt(row.next_run_at)
    if (persistedNext) {
      return {
        ...sub,
        status: "active",
        next_run_at: persistedNext,
      }
    }
    return { ...sub, status: "active" }
  } catch {
    return sub
  }
}

/**
 * MVP: surface Subscribe & Save from completed orders and from open carts (draft).
 * Full subscription module can replace this later.
 */
export async function buildCustomerSubscriptions(
  container: MedusaContainer,
  customerId: string
): Promise<StoreSubscription[]> {
  const orderModule = container.resolve(Modules.ORDER) as unknown as {
    listOrders: (
      filters?: Record<string, unknown>,
      config?: Record<string, unknown>
    ) => Promise<Record<string, unknown>[]>
  }

  const cartModule = container.resolve(Modules.CART) as unknown as {
    listCarts: (
      filters?: Record<string, unknown>,
      config?: Record<string, unknown>
    ) => Promise<Record<string, unknown>[]>
  }

  const orders = await orderModule.listOrders(
    {
      customer_id: customerId,
      canceled_at: null,
      is_draft_order: false,
    },
    {
      relations: ["items", "items.item", "shipping_address"],
      order: { created_at: "DESC" },
      take: 100,
    }
  )

  const carts = await cartModule.listCarts(
    { customer_id: customerId, completed_at: null },
    {
      relations: ["items", "shipping_address"],
      order: { updated_at: "DESC" },
      take: 20,
    }
  )

  const byKey = new Map<string, StoreSubscription>()

  for (const order of orders) {
    const items = (order.items as Record<string, unknown>[] | undefined) ?? []
    const currency = String(order.currency_code ?? "usd")
    const shipping = shippingFromOrderAddress(
      order.shipping_address as Record<string, unknown> | null | undefined
    )
    const anchor = orderAnchorDate(order)

    for (const ordItem of items) {
      const detail = (ordItem.item as Record<string, unknown> | undefined) ?? ordItem
      const meta = mergeMetadata(
        detail.metadata as Record<string, unknown> | null | undefined,
        ordItem.metadata as Record<string, unknown> | null | undefined
      )
      const days = parseSubscribeDays(meta)
      if (days == null) continue

      const variantId = (detail.variant_id as string) ?? ""
      const key = dedupeKey(variantId, days)
      if (byKey.has(key)) continue

      // Prefer OrderItem id (orditem_…); fall back to nested line item id (ordli_…) for a stable osub_* key.
      const ordItemId = String(ordItem.id ?? "") || String(detail.id ?? "")
      const next = addDaysUtc(anchor, days)

      const sub: StoreSubscription = {
        id: ordItemId ? `osub_${ordItemId}` : `osub_${order.id}_${variantId}_${days}`,
        status: "active",
        interval_unit: "day",
        interval_count: days,
        currency_code: currency,
        next_run_at: next.toISOString(),
        last_run_at: anchor.toISOString(),
        items: [
          {
            id: String(detail.id ?? ordItem.id ?? variantId),
            variant_id: variantId,
            product_id: (detail.product_id as string) ?? null,
            product_title: (detail.product_title as string) ?? null,
            variant_title: (detail.variant_title as string) ?? null,
            thumbnail: (detail.thumbnail as string) ?? null,
            quantity: toQuantity(ordItem.quantity),
          },
        ],
        payment: null,
        shipping,
        metadata: { source: "order", order_id: order.id },
      }
      const merged = await mergePersistedOsub(sub)
      if (merged) {
        byKey.set(key, merged)
      }
    }
  }

  for (const cart of carts) {
    const lines = (cart.items as Record<string, unknown>[] | undefined) ?? []
    const currency = String(cart.currency_code ?? "usd")
    const shipAddr = cart.shipping_address as Record<string, unknown> | null | undefined
    const shipping = shippingFromOrderAddress(
      shipAddr && typeof shipAddr === "object" ? shipAddr : null
    )
    const now = new Date()

    for (const line of lines) {
      const meta = (line.metadata as Record<string, unknown> | null | undefined) ?? {}
      const days = parseSubscribeDays(meta)
      if (days == null) continue

      const variantId = (line.variant_id as string) ?? ""
      const key = dedupeKey(variantId, days)
      if (byKey.has(key)) continue

      const lineId = String(line.id ?? "")
      const next = addDaysUtc(now, days)

      const sub: StoreSubscription = {
        id: lineId ? `csub_${lineId}` : `csub_${cart.id}_${variantId}_${days}`,
        status: "draft",
        interval_unit: "day",
        interval_count: days,
        currency_code: currency,
        next_run_at: next.toISOString(),
        last_run_at: null,
        items: [
          {
            id: lineId || variantId,
            variant_id: variantId,
            product_id: (line.product_id as string) ?? null,
            product_title: (line.product_title as string) ?? null,
            variant_title: (line.variant_title as string) ?? null,
            thumbnail: (line.thumbnail as string) ?? null,
            quantity: toQuantity(line.quantity),
          },
        ],
        payment: null,
        shipping,
        metadata: { source: "cart", cart_id: cart.id },
      }
      byKey.set(key, sub)
    }
  }

  const list = [...byKey.values()]
  const nextTs = (s: StoreSubscription) =>
    s.next_run_at ? new Date(s.next_run_at).getTime() : Number.POSITIVE_INFINITY
  list.sort((a, b) => {
    if (a.status === "draft" && b.status !== "draft") return 1
    if (b.status === "draft" && a.status !== "draft") return -1
    return nextTs(a) - nextTs(b)
  })
  return list
}
