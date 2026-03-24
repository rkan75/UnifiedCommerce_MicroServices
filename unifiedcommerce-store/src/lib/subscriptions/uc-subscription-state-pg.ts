import pg from "pg"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type UcSubscriptionStateStatus = "active" | "paused" | "cancelled"

export type UcSubscriptionStateRow = {
  id: string
  customer_id: string
  order_item_id: string
  variant_id: string
  interval_days: number
  status: UcSubscriptionStateStatus
  next_run_at: Date | null
  next_run_snapshot_pause: Date | null
  cancelled_at: Date | null
}

let pool: pg.Pool | null = null
let tableEnsured = false

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 5 })
  }
  return pool
}

export async function ensureUcSubscriptionStateTable(): Promise<boolean> {
  const p = getPool()
  if (!p) return false
  if (tableEnsured) return true
  await p.query(`CREATE TABLE IF NOT EXISTS uc_subscription_state (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      interval_days INT NOT NULL CHECK (interval_days > 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
      next_run_at TIMESTAMPTZ,
      next_run_snapshot_pause TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  await p.query(
    `CREATE INDEX IF NOT EXISTS idx_uc_sub_state_customer ON uc_subscription_state (customer_id)`
  )
  tableEnsured = true
  return true
}

export async function getUcSubscriptionState(
  id: string
): Promise<UcSubscriptionStateRow | null> {
  if (!(await ensureUcSubscriptionStateTable())) return null
  const p = getPool()
  if (!p) return null
  const { rows } = await p.query<UcSubscriptionStateRow>(
    `SELECT id, customer_id, order_item_id, variant_id, interval_days, status,
            next_run_at, next_run_snapshot_pause, cancelled_at
     FROM uc_subscription_state WHERE id = $1`,
    [id]
  )
  return rows[0] ?? null
}

export async function upsertUcSubscriptionState(row: {
  id: string
  customer_id: string
  order_item_id: string
  variant_id: string
  interval_days: number
  status: UcSubscriptionStateStatus
  next_run_at: Date | null
  next_run_snapshot_pause: Date | null
  cancelled_at: Date | null
}): Promise<void> {
  if (!(await ensureUcSubscriptionStateTable())) {
    throw new Error("uc_subscription_state table unavailable (DATABASE_URL?)")
  }
  const p = getPool()
  if (!p) throw new Error("Database pool unavailable")
  await p.query(
    `INSERT INTO uc_subscription_state (
       id, customer_id, order_item_id, variant_id, interval_days, status,
       next_run_at, next_run_snapshot_pause, cancelled_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (id) DO UPDATE SET
       customer_id = EXCLUDED.customer_id,
       order_item_id = EXCLUDED.order_item_id,
       variant_id = EXCLUDED.variant_id,
       interval_days = EXCLUDED.interval_days,
       status = EXCLUDED.status,
       next_run_at = EXCLUDED.next_run_at,
       next_run_snapshot_pause = EXCLUDED.next_run_snapshot_pause,
       cancelled_at = EXCLUDED.cancelled_at,
       updated_at = NOW()`,
    [
      row.id,
      row.customer_id,
      row.order_item_id,
      row.variant_id,
      row.interval_days,
      row.status,
      row.next_run_at,
      row.next_run_snapshot_pause,
      row.cancelled_at,
    ]
  )
}

const SUBSCRIBE_SAVE_OPT_OUT = "subscribe_save_opt_out"

export async function mergeCustomerSubscribeSaveOptOut(
  container: MedusaContainer,
  customerId: string,
  variantId: string,
  intervalDays: number
): Promise<void> {
  const customerModule = container.resolve(Modules.CUSTOMER) as unknown as {
    updateCustomers: (
      id: string,
      data: { metadata?: Record<string, unknown> | null }
    ) => Promise<unknown>
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: {
      entity: string
      fields: string[]
      filters?: Record<string, unknown>
    }) => Promise<{ data: { id: string; metadata?: Record<string, unknown> | null }[] }>
  }

  const key = `${variantId}:${intervalDays}`
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "metadata"],
    filters: { id: customerId },
  })
  const existing = data?.[0]
  if (!existing) return

  const meta = { ...(existing.metadata ?? {}) }
  const rawOpt = meta[SUBSCRIBE_SAVE_OPT_OUT]
  const optOut: Record<string, boolean> =
    rawOpt && typeof rawOpt === "object" && !Array.isArray(rawOpt)
      ? { ...(rawOpt as Record<string, boolean>) }
      : {}
  optOut[key] = true
  meta[SUBSCRIBE_SAVE_OPT_OUT] = optOut

  await customerModule.updateCustomers(customerId, { metadata: meta })
}
