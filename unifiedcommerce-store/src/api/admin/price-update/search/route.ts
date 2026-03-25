/**
 * Decommissioned: product search for store tools lives on Java products-service.
 * Store backoffice: set VITE_PRODUCTS_SERVICE_URL.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(410).json({
    type: "gone",
    message:
      "Admin product search on Medusa is removed. Use Java GET /store/products via VITE_PRODUCTS_SERVICE_URL on the store backoffice.",
  })
}
