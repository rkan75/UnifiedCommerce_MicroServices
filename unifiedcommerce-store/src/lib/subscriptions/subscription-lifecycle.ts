import type { MedusaContainer } from "@medusajs/framework/types"

import { resolveOsubForCustomer } from "./order-subscription-resolve"
import {
  getUcSubscriptionState,
  mergeCustomerSubscribeSaveOptOut,
  upsertUcSubscriptionState,
} from "./uc-subscription-state-pg"

function addDaysUtc(d: Date, days: number): Date {
  const t = new Date(d.getTime())
  t.setUTCDate(t.getUTCDate() + days)
  return t
}

/** Normalize DB / API timestamps for date math. */
function asDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : value
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

async function ensureRowFromResolved(
  container: MedusaContainer,
  customerId: string,
  publicId: string
) {
  const resolved = await resolveOsubForCustomer(container, customerId, publicId)
  if (!resolved) {
    return { error: "Subscription not found" as const }
  }
  let row = await getUcSubscriptionState(publicId)
  if (!row) {
    await upsertUcSubscriptionState({
      id: publicId,
      customer_id: customerId,
      order_item_id: resolved.orderItemId,
      variant_id: resolved.variantId,
      interval_days: resolved.intervalDays,
      status: "active",
      next_run_at: resolved.computedNextRun,
      next_run_snapshot_pause: null,
      cancelled_at: null,
    })
    row = await getUcSubscriptionState(publicId)
  }
  if (!row || row.customer_id !== customerId) {
    return { error: "Subscription not found" as const }
  }
  return { resolved, row }
}

export async function performSkipNext(
  container: MedusaContainer,
  customerId: string,
  publicId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = await ensureRowFromResolved(container, customerId, publicId)
  if ("error" in base) return { ok: false, message: base.error as string }
  const { resolved, row } = base
  if (row.status === "cancelled") {
    return { ok: false, message: "Subscription is cancelled" }
  }
  if (row.status === "paused") {
    return { ok: false, message: "Resume the subscription before skipping" }
  }

  // Skip = push schedule forward by one full interval from the *current* next refill (not from today).
  const scheduled =
    asDate(row.next_run_at) ?? resolved.computedNextRun
  const next = addDaysUtc(scheduled, resolved.intervalDays)
  await upsertUcSubscriptionState({
    id: publicId,
    customer_id: customerId,
    order_item_id: resolved.orderItemId,
    variant_id: resolved.variantId,
    interval_days: resolved.intervalDays,
    status: "active",
    next_run_at: next,
    next_run_snapshot_pause: null,
    cancelled_at: null,
  })
  return { ok: true }
}

export async function performPause(
  container: MedusaContainer,
  customerId: string,
  publicId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = await ensureRowFromResolved(container, customerId, publicId)
  if ("error" in base) return { ok: false, message: base.error as string }
  const { resolved, row } = base
  if (row.status === "cancelled") {
    return { ok: false, message: "Subscription is cancelled" }
  }
  if (row.status === "paused") {
    return { ok: true }
  }

  const effectiveNext =
    row.next_run_at ?? resolved.computedNextRun

  await upsertUcSubscriptionState({
    id: publicId,
    customer_id: customerId,
    order_item_id: resolved.orderItemId,
    variant_id: resolved.variantId,
    interval_days: resolved.intervalDays,
    status: "paused",
    next_run_at: null,
    next_run_snapshot_pause: effectiveNext,
    cancelled_at: null,
  })
  return { ok: true }
}

export async function performResume(
  container: MedusaContainer,
  customerId: string,
  publicId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = await ensureRowFromResolved(container, customerId, publicId)
  if ("error" in base) return { ok: false, message: base.error as string }
  const { resolved, row } = base
  if (row.status === "cancelled") {
    return { ok: false, message: "Subscription is cancelled" }
  }
  if (row.status !== "paused") {
    return { ok: false, message: "Subscription is not paused" }
  }

  const next = addDaysUtc(new Date(), resolved.intervalDays)
  await upsertUcSubscriptionState({
    id: publicId,
    customer_id: customerId,
    order_item_id: resolved.orderItemId,
    variant_id: resolved.variantId,
    interval_days: resolved.intervalDays,
    status: "active",
    next_run_at: next,
    next_run_snapshot_pause: null,
    cancelled_at: null,
  })
  return { ok: true }
}

export async function performCancel(
  container: MedusaContainer,
  customerId: string,
  publicId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = await ensureRowFromResolved(container, customerId, publicId)
  if ("error" in base) return { ok: false, message: base.error as string }
  const { resolved, row } = base
  if (row.status === "cancelled") {
    return { ok: true }
  }

  await upsertUcSubscriptionState({
    id: publicId,
    customer_id: customerId,
    order_item_id: resolved.orderItemId,
    variant_id: resolved.variantId,
    interval_days: resolved.intervalDays,
    status: "cancelled",
    next_run_at: null,
    next_run_snapshot_pause: null,
    cancelled_at: new Date(),
  })

  await mergeCustomerSubscribeSaveOptOut(
    container,
    customerId,
    resolved.variantId,
    resolved.intervalDays
  )
  return { ok: true }
}
