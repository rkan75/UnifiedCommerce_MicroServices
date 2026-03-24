import { HttpTypes } from "@medusajs/types"

/** Trimmed "First Last" for display; empty string if nothing usable. */
export function getCustomerFullName(
  customer: HttpTypes.StoreCustomer | null
): string {
  if (!customer) return ""
  const parts = [customer.first_name, customer.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
  return parts.join(" ").trim()
}

function coerceNonNegativeInt(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.floor(value)
    return n >= 0 ? n : null
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value.trim(), 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return null
}

/**
 * Reads loyalty / rewards points from customer.metadata.
 * Supports common keys (set via Admin or integrations).
 */
export function getLoyaltyPoints(
  customer: HttpTypes.StoreCustomer | null
): number | null {
  const meta = customer?.metadata
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null
  const m = meta as Record<string, unknown>
  const keys = [
    "loyalty_points",
    "loyaltyPoints",
    "points",
    "reward_points",
    "rewardPoints",
    "gnc_loyalty_points",
    "pro_access_points",
  ]
  for (const k of keys) {
    const n = coerceNonNegativeInt(m[k])
    if (n != null) return n
  }
  return null
}
