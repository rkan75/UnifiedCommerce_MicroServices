/**
 * Default Medusa product type for this storefront: PLP, search listing, categories, and
 * department facets only include products (and category branches) tied to this type unless
 * you override or disable scoping below.
 *
 * Collections are inferred from products the same way (see `listCollections`).
 *
 * Override:
 * - `STOREFRONT_PRODUCT_TYPE_ID=<other ptyp_…>` — use another type id.
 *
 * Disable catalog type scoping (show all product types Medusa returns):
 * - `STOREFRONT_PRODUCT_TYPE_ID=all`
 *
 * Optional: `STOREFRONT_PRODUCT_TYPE_VALUE` — when **no** id resolves (e.g. `all`), match type by
 * Medusa `value` (see `resolveStorefrontProductTypeId`). If both id and value could apply, id wins.
 *
 * Does not affect order history / past purchases (those use order line data, not catalog list APIs).
 */
export const STOREFRONT_HEALTH_WELLNESS_PRODUCT_TYPE_ID =
  "ptyp_01KM44HB9H03N9JPVC3Q79Y4XE"

export function getStorefrontProductTypeId(): string | null {
  const raw = process.env.STOREFRONT_PRODUCT_TYPE_ID?.trim()
  if (!raw) {
    return STOREFRONT_HEALTH_WELLNESS_PRODUCT_TYPE_ID
  }
  if (raw.toLowerCase() === "all" || raw === "__ALL__") {
    return null
  }
  return raw
}

/** Medusa product type `value` for `STOREFRONT_PRODUCT_TYPE_VALUE` resolution. */
export function getStorefrontProductTypeValue(): string | null {
  const raw = process.env.STOREFRONT_PRODUCT_TYPE_VALUE?.trim()
  return raw || null
}

/** Stable cache key segment when product listing is scoped by type (id or value env). */
export function getStorefrontProductTypeConfigKey(): string {
  return [getStorefrontProductTypeId() ?? "", getStorefrontProductTypeValue() ?? ""].join("|")
}
