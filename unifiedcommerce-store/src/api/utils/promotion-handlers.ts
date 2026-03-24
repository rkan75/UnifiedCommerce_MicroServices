/**
 * Promotion API handlers that bypass framework RBAC (promotion:undefined).
 * Any authenticated admin can create, read, update, and delete promotions.
 * Same behavior as framework routes; used by the same promotion screen.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  createPromotionsWorkflow,
  updatePromotionsWorkflow,
  deletePromotionsWorkflow,
} from "@medusajs/core-flows"
import { ContainerRegistrationKeys, MedusaError, remoteQueryObjectFromString } from "@medusajs/framework/utils"

/**
 * Medusa pricing expects fixed promotion value in minor units (cents).
 * If the admin sends a decimal like 0.25 (meaning 25 cents), convert to 25 before save.
 */
function normalizeFixedValueToCents(payload: Record<string, unknown>): void {
  const am = payload.application_method as Record<string, unknown> | undefined
  if (!am || am.type !== "fixed") return
  const v = am.value
  if (typeof v !== "number" || v <= 0) return
  // Value in (0, 100) with decimals is likely dollars; convert to cents
  if (v < 100 && v % 1 !== 0) {
    am.value = Math.round(v * 100)
  }
}

/** Scalar fields only — no * relation syntax (MikroORM rejects '*campaign' etc.). */
export const DEFAULT_PROMOTION_FIELDS = [
  "id",
  "code",
  "is_automatic",
  "is_tax_inclusive",
  "type",
  "limit",
  "used",
  "status",
  "created_at",
  "updated_at",
  "deleted_at",
]

type Scope = { resolve: (key: string) => unknown }

async function remoteQuery(scope: Scope, entryPoint: string, variables: object, fields: string[]) {
  const q = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (query: object) => Promise<{ rows?: unknown[]; metadata?: { count?: number; skip?: number; take?: number } }>
  const queryObject = remoteQueryObjectFromString({
    entryPoint,
    variables,
    fields,
  })
  const result = await q(queryObject)
  return result
}

function getRowsFromResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows?: unknown[] }).rows))
    return (result as { rows: unknown[] }).rows
  return []
}

/** Ensure promotion has nested shape expected by dashboard (detail/edit) to avoid render errors. */
function normalizePromotionForDashboard(p: unknown): Record<string, unknown> {
  const promotion = (p && typeof p === "object" ? p : {}) as Record<string, unknown>
  const appMethod = (promotion.application_method && typeof promotion.application_method === "object"
    ? promotion.application_method
    : {}) as Record<string, unknown>
  let displayValue = appMethod.value ?? 0
  // Fixed amount is stored in cents; show dashboard major units (dollars) so admin sees 0.25 not 25
  if (appMethod.type === "fixed" && typeof displayValue === "number" && displayValue >= 1) {
    displayValue = Math.round(displayValue) / 100
  }
  promotion.application_method = {
    ...appMethod,
    type: appMethod.type ?? "fixed",
    target_type: appMethod.target_type ?? "items",
    value: displayValue,
    allocation: appMethod.allocation ?? "each",
    max_quantity: appMethod.max_quantity ?? null,
    currency_code: appMethod.currency_code ?? "usd",
    buy_rules: Array.isArray(appMethod.buy_rules) ? appMethod.buy_rules : [],
    target_rules: Array.isArray(appMethod.target_rules) ? appMethod.target_rules : [],
  }
  if (!("campaign" in promotion)) promotion.campaign = null
  if (!Array.isArray(promotion.rules)) promotion.rules = []
  return promotion
}

async function refetchPromotion(
  promotionId: string,
  scope: Scope,
  fields: string[] = DEFAULT_PROMOTION_FIELDS
): Promise<unknown> {
  const result = await remoteQuery(scope, "promotion", { filters: { id: promotionId } }, fields)
  const rows = getRowsFromResult(result)
  return rows[0]
}

/** GET /admin/promotions - list promotions */
export async function handleList(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = (req as any).query ?? {}
  const filterableFields = (req as any).filterableFields ?? {}
  const skip = Math.max(0, parseInt(String(query.offset), 10) || 0)
  const take = Math.min(100, Math.max(1, parseInt(String(query.limit), 10) || 10))
  const fields = (req as any).queryConfig?.fields ?? DEFAULT_PROMOTION_FIELDS
  const fieldList = Array.isArray(fields) ? fields : DEFAULT_PROMOTION_FIELDS
  const variables = {
    filters: typeof filterableFields === "object" && filterableFields !== null && Object.keys(filterableFields).length > 0
      ? filterableFields
      : {},
    skip,
    take,
  }
  try {
    const result = await remoteQuery(req.scope, "promotion", variables, fieldList)
    const rows = "rows" in result ? (result as { rows?: unknown[] }).rows ?? [] : []
    const metadata = (result as { metadata?: { count?: number; skip?: number; take?: number } }).metadata ?? {}
    res.json({
      promotions: Array.isArray(rows) ? rows : [],
      count: metadata.count ?? (Array.isArray(rows) ? rows.length : 0),
      offset: metadata.skip ?? skip,
      limit: metadata.take ?? take,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[promotion-handlers] handleList error:", message, stack)
    res.status(500).json({
      type: "unknown_error",
      message: message || "Failed to list promotions.",
    })
  }
}

/** GET /admin/promotions/:id - get one promotion by id or code */
export async function handleGetOne(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const idOrCode = (req as any).params?.id as string
  if (!idOrCode) {
    res.status(400).json({ type: "invalid_data", message: "Promotion id or code is required." })
    return
  }
  const fields = (req as any).queryConfig?.fields ?? DEFAULT_PROMOTION_FIELDS
  const fieldList = Array.isArray(fields) ? fields : DEFAULT_PROMOTION_FIELDS
  let result = await remoteQuery(req.scope, "promotion", { filters: { id: idOrCode } }, fieldList)
  let rows = getRowsFromResult(result)
  if (!rows[0]) {
    result = await remoteQuery(req.scope, "promotion", { filters: { code: idOrCode } }, fieldList)
    rows = getRowsFromResult(result)
  }
  const promotion = rows[0]
  if (!promotion) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Promotion with id or code: ${idOrCode} was not found`
    )
  }
  res.status(200).json({ promotion: normalizePromotionForDashboard(promotion) })
}

/** POST /admin/promotions - create promotion */
export async function handleCreate(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = ((req as any).validatedBody ?? (req as any).body) as Record<string, unknown> | undefined
  if (!body || typeof body !== "object") {
    res.status(400).json({
      type: MedusaError.Types.INVALID_DATA,
      code: "invalid_data",
      message: "Request body is required to create a promotion.",
    })
    return
  }
  const { additional_data, ...rest } = body as { additional_data?: unknown; [k: string]: unknown }
  normalizeFixedValueToCents(rest as Record<string, unknown>)
  const createPromotions = createPromotionsWorkflow(req.scope)
  const { result } = await createPromotions.run({
    input: {
      promotionsData: [rest],
      additional_data: (additional_data ?? {}) as Record<string, unknown>,
    } as any,
  })
  const id = result?.[0]?.id
  if (!id) {
    res.status(500).json({ type: "unknown_error", message: "Promotion was not created." })
    return
  }
  const fields = (req as any).queryConfig?.fields ?? DEFAULT_PROMOTION_FIELDS
  const raw = await refetchPromotion(id, req.scope, Array.isArray(fields) ? fields : DEFAULT_PROMOTION_FIELDS)
  res.status(200).json({ promotion: normalizePromotionForDashboard(raw) })
}

/** POST /admin/promotions/:id - update promotion (separate flow from create) */
export async function handleUpdate(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req as any).params?.id as string
  if (!id) {
    res.status(400).json({ type: "invalid_data", message: "Promotion id is required." })
    return
  }
  const body = ((req as any).validatedBody ?? (req as any).body) as Record<string, unknown> | undefined
  if (!body || typeof body !== "object") {
    res.status(400).json({
      type: MedusaError.Types.INVALID_DATA,
      code: "invalid_data",
      message: "Request body is required to update a promotion.",
    })
    return
  }
  const { additional_data, ...rest } = body as { additional_data?: unknown; [k: string]: unknown }
  const updatePayload = { id, ...rest } as Record<string, unknown>
  normalizeFixedValueToCents(updatePayload)
  const updatePromotions = updatePromotionsWorkflow(req.scope)
  await updatePromotions.run({
    input: {
      promotionsData: [updatePayload],
      additional_data: (additional_data ?? {}) as Record<string, unknown>,
    } as any,
  })
  const fields = (req as any).queryConfig?.fields ?? DEFAULT_PROMOTION_FIELDS
  const raw = await refetchPromotion(id, req.scope, Array.isArray(fields) ? fields : DEFAULT_PROMOTION_FIELDS)
  res.status(200).json({ promotion: normalizePromotionForDashboard(raw) })
}

/** DELETE /admin/promotions/:id - delete promotion */
export async function handleDelete(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req as any).params?.id as string
  if (!id) {
    res.status(400).json({ type: "invalid_data", message: "Promotion id is required." })
    return
  }
  const deletePromotions = deletePromotionsWorkflow(req.scope)
  await deletePromotions.run({ input: { ids: [id] } })
  res.status(200).json({
    id,
    object: "promotion",
    deleted: true,
  })
}
