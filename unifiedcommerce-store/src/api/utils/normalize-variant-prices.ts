/**
 * Normalize variant update body so price amounts are stored in cents.
 * Medusa Pricing expects amount in the smallest currency unit (e.g. cents for USD).
 * If the admin sends a decimal amount (e.g. 9.99), treat it as major units and convert to cents.
 */
export type VariantPriceInput = {
  id?: string
  currency_code?: string
  amount?: number
  min_quantity?: number | null
  max_quantity?: number | null
  rules?: Record<string, string>
}

export type VariantUpdateBody = {
  prices?: VariantPriceInput[]
  [key: string]: unknown
}

/**
 * If amount looks like major units (has decimal or is a small integer that could be dollars),
 * convert to cents. Avoids double-conversion when admin already sends cents.
 */
function amountToCents(amount: number): number {
  if (typeof amount !== "number" || Number.isNaN(amount)) return amount
  // Already an integer >= 100 is likely cents (e.g. 999, 1000)
  if (Number.isInteger(amount) && amount >= 100) return amount
  // Has decimal part (e.g. 9.99) or small integer (e.g. 10) -> assume major units
  if (!Number.isInteger(amount) || amount < 100) {
    return Math.round(amount * 100)
  }
  return amount
}

/**
 * Mutates and returns the same object with normalized prices.
 */
export function normalizeVariantUpdatePrices(body: VariantUpdateBody): VariantUpdateBody {
  if (!body || !Array.isArray(body.prices) || body.prices.length === 0) return body
  body.prices = body.prices.map((p) => {
    if (p && typeof p === "object" && typeof (p as VariantPriceInput).amount === "number") {
      return { ...p, amount: amountToCents((p as VariantPriceInput).amount!) }
    }
    return p
  })
  return body
}

/**
 * Normalize prices to cents for each item in a batch update array.
 * Use for POST /admin/products/:id/variants/batch (pricing table save).
 */
export function normalizeBatchUpdatePrices(
  update: Array<{ id: string; prices?: VariantPriceInput[]; [key: string]: unknown }> | undefined
): typeof update {
  if (!Array.isArray(update)) return update
  return update.map((item) => normalizeVariantUpdatePrices(item as VariantUpdateBody) as typeof item)
}
