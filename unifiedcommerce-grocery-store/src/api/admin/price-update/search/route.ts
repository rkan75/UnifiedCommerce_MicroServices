/**
 * GET /admin/price-update/search?q=<product_id_or_name>
 * Search products by ID (exact) or by name (substring). Returns product(s) with variants and prices.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { remapProductResponse } from "../../../utils/product-variant-response-helpers"

const PRODUCT_FIELDS = [
  "id",
  "title",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.price_set.id",
  "variants.price_set.prices.id",
  "variants.price_set.prices.amount",
  "variants.price_set.prices.currency_code",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = (req.query?.q as string)?.trim()
  if (!q) {
    return res.status(400).json({ message: "Query parameter 'q' (product ID or name) is required." })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: {
      entity: string
      fields: string[]
      filters?: Record<string, unknown>
    }) => Promise<{ data: any[] }>
  }

  try {
    const isId = /^prod_[a-z0-9]+$/i.test(q)
    let data: any[] = []

    if (isId) {
      const result = await query.graph({
        entity: "product",
        fields: PRODUCT_FIELDS,
        filters: { id: q },
      })
      data = result?.data ?? []
    } else {
      const result = await query.graph({
        entity: "product",
        fields: PRODUCT_FIELDS,
      })
      const all = (result?.data ?? []).slice(0, 500)
      const lower = q.toLowerCase()
      data = all.filter(
        (p: { title?: string }) => (p.title ?? "").toLowerCase().includes(lower)
      )
      if (data.length > 20) {
        data = data.slice(0, 20)
      }
    }

    const products = data.map((p) => remapProductResponse(p))
    return res.json({ products })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed"
    return res.status(500).json({ message })
  }
}
