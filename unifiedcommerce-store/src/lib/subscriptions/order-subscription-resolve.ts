import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/** Same keys as storefront subscribe-save-metadata. */
const SUBSCRIBE_AND_SAVE = "subscribe_and_save"
const SHIP_EVERY_DAYS = "ship_every_days"
const SUBSCRIBE_TRUE = "true"
const ALLOWED_DAYS = new Set(["30", "45", "60", "90"])

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

export type ResolvedOrderSubscribeLine = {
  publicId: string
  orderItemId: string
  variantId: string
  intervalDays: number
  computedNextRun: Date
  computedLastRun: Date
  currencyCode: string
}

/**
 * Validates `osub_<orderItemId>` belongs to the customer and has subscribe metadata.
 */
export async function resolveOsubForCustomer(
  container: MedusaContainer,
  customerId: string,
  publicId: string
): Promise<ResolvedOrderSubscribeLine | null> {
  if (!publicId.startsWith("osub_")) return null
  const orderItemId = publicId.slice("osub_".length)
  if (!orderItemId) return null

  const orderModule = container.resolve(Modules.ORDER) as unknown as {
    listOrders: (
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
      relations: ["items", "items.item"],
      order: { created_at: "DESC" },
      take: 100,
    }
  )

  for (const order of orders) {
    const items = (order.items as Record<string, unknown>[] | undefined) ?? []
    for (const ordItem of items) {
      const detail = (ordItem.item as Record<string, unknown> | undefined) ?? ordItem
      const orderItemRowId = String(ordItem.id ?? "")
      const lineItemId = String(detail.id ?? "")
      // Public id may be osub_<orditem_…> or osub_<ordli_…> depending on API shape.
      if (orderItemRowId !== orderItemId && lineItemId !== orderItemId) continue
      const meta = mergeMetadata(
        detail.metadata as Record<string, unknown> | null | undefined,
        ordItem.metadata as Record<string, unknown> | null | undefined
      )
      const days = parseSubscribeDays(meta)
      if (days == null) return null

      const variantId = String((detail.variant_id as string) ?? "")
      const anchor = orderAnchorDate(order)
      const next = addDaysUtc(anchor, days)

      return {
        publicId,
        orderItemId,
        variantId,
        intervalDays: days,
        computedNextRun: next,
        computedLastRun: anchor,
        currencyCode: String(order.currency_code ?? "usd"),
      }
    }
  }

  return null
}
