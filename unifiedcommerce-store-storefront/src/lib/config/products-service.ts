const PUBLISHABLE_API_KEY_HEADER = "x-publishable-api-key"

/**
 * Medusa store catalog routes require this header. The Java products-service ignores it.
 */
export function getMedusaPublishableKeyHeaders(): Record<string, string> {
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim()
  return pk ? { [PUBLISHABLE_API_KEY_HEADER]: pk } : {}
}

/**
 * Catalog base URL for GET /store/products and /store/product-variants.
 * Prefer Java products-service; falls back to Medusa when PRODUCTS_SERVICE_URL is unset.
 */
let warnedProductsServiceFallback = false

export function getProductsServiceBaseUrl(): string {
  const raw = process.env.PRODUCTS_SERVICE_URL?.trim()
  if (raw) {
    return raw.replace(/\/$/, "")
  }
  const medusa = process.env.MEDUSA_BACKEND_URL?.trim()
  if (medusa) {
    if (
      process.env.NODE_ENV === "development" &&
      !warnedProductsServiceFallback
    ) {
      warnedProductsServiceFallback = true
      console.warn(
        "[storefront] PRODUCTS_SERVICE_URL is unset; using MEDUSA_BACKEND_URL for catalog. " +
          "Set PRODUCTS_SERVICE_URL=http://localhost:8082 when using the Java products-service."
      )
    }
    return medusa.replace(/\/$/, "")
  }
  throw new Error(
    "Set PRODUCTS_SERVICE_URL (Java products-service, e.g. http://localhost:8082) or MEDUSA_BACKEND_URL for catalog API."
  )
}
