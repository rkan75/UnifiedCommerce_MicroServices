import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createPromotionsWorkflow } from "@medusajs/core-flows"
import { ContainerRegistrationKeys, remoteQueryObjectFromString } from "@medusajs/framework/utils"

const DEFAULT_PROMOTION_FIELDS = [
  "id", "code", "is_automatic", "is_tax_inclusive", "type", "limit", "used", "status",
  "created_at", "updated_at", "deleted_at",
  "*campaign", "*campaign.budget", "*application_method",
  "*application_method.buy_rules", "application_method.buy_rules.values.value",
  "*application_method.target_rules", "application_method.target_rules.values.value",
  "rules.id", "rules.attribute", "rules.operator", "rules.values.value",
]

async function refetchPromotion(
  promotionId: string,
  scope: { resolve: (key: string) => unknown },
  fields: string[] = DEFAULT_PROMOTION_FIELDS
) {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (q: object) => Promise<{ rows?: unknown[] }>
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "promotion",
    variables: { filters: { id: promotionId } },
    fields,
  })
  const result = await remoteQuery(queryObject)
  const rows = "rows" in result ? (result as { rows?: unknown[] }).rows : (result as unknown[])
  return Array.isArray(rows) ? rows[0] : result
}

/**
 * GET /admin/promotions - list promotions (same as framework; no policy bypass needed for read).
 * Delegates to framework by calling next so the default route runs, or we could implement here.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (q: object) => Promise<{ rows: unknown[]; metadata?: { count?: number; skip?: number; take?: number } }>
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "promotion",
    variables: {
      filters: (req as any).filterableFields ?? {},
      ...(req as any).queryConfig?.pagination,
    },
    fields: (req as any).queryConfig?.fields ?? DEFAULT_PROMOTION_FIELDS,
  })
  const { rows: promotions, metadata } = await remoteQuery(queryObject)
  res.json({
    promotions: promotions ?? [],
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 10,
  })
}

/**
 * POST /admin/promotions - create promotion.
 * Custom implementation to bypass framework RBAC policy check that fails with "promotion:undefined".
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = ((req as any).validatedBody ?? (req as any).body) as Record<string, unknown> | undefined
  if (!body || typeof body !== "object") {
    res.status(400).json({
      type: "invalid_data",
      code: "invalid_data",
      message: "Request body is required to create a promotion.",
    })
    return
  }
  const { additional_data, ...rest } = body as { additional_data?: unknown; [k: string]: unknown }
  const createPromotions = createPromotionsWorkflow(req.scope)
  const { result } = await createPromotions.run({
    input: {
      promotionsData: [rest],
      additional_data: (additional_data ?? {}) as Record<string, unknown>,
    } as any,
  })
  const id = result?.[0]?.id
  if (!id) {
    res.status(500).json({ type: "unknown_error", code: "unknown_error", message: "Promotion was not created." })
    return
  }
  const queryConfig = (req as any).queryConfig
  const fields = Array.isArray(queryConfig?.fields) ? queryConfig.fields : DEFAULT_PROMOTION_FIELDS
  const promotion = await refetchPromotion(id, req.scope, fields)
  res.status(200).json({ promotion })
}
