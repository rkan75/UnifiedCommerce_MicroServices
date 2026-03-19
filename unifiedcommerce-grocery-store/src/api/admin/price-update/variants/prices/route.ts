/**
 * POST /admin/price-update/variants/prices
 * Body: { variantPrices: Array<{ variant_id: string; product_id: string; prices: Array<{ id?: string; amount: number; currency_code: string }> }> }
 * Amount in smallest currency unit (e.g. cents for USD). Updates variant prices via upsertVariantPricesWorkflow.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows"

type PriceInput = { id?: string; amount: number; currency_code: string }
type VariantPriceInput = { variant_id: string; product_id: string; prices: PriceInput[] }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? req.validatedBody) as { variantPrices?: VariantPriceInput[] }
  const variantPrices = Array.isArray(body?.variantPrices) ? body.variantPrices : []

  if (variantPrices.length === 0) {
    return res.status(400).json({ message: "Body must include variantPrices array with at least one item." })
  }

  for (const vp of variantPrices) {
    if (!vp.variant_id || !vp.product_id || !Array.isArray(vp.prices)) {
      return res.status(400).json({
        message: "Each item must have variant_id, product_id, and prices (array).",
      })
    }
  }

  try {
    await upsertVariantPricesWorkflow(req.scope).run({
      input: {
        variantPrices,
        previousVariantIds: variantPrices.map((v) => v.variant_id),
      },
    })
    return res.status(200).json({ success: true, updated: variantPrices.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update prices"
    return res.status(500).json({ message })
  }
}
