const PUBLISHABLE_API_KEY_HEADER = "x-publishable-api-key"

/**
 * Medusa store used this header; Java catalog services ignore it. Safe to send when present.
 */
export function getMedusaPublishableKeyHeaders(): Record<string, string> {
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim()
  return pk ? { [PUBLISHABLE_API_KEY_HEADER]: pk } : {}
}

function requireJavaServiceBaseUrl(
  envVar: string | undefined,
  envName: string
): string {
  const raw = envVar?.trim()
  if (!raw) {
    throw new Error(
      `Set ${envName} to your Java service base URL. Medusa is not used for catalog APIs.`
    )
  }
  return raw.replace(/\/$/, "")
}

export function getProductsServiceBaseUrl(): string {
  return requireJavaServiceBaseUrl(
    process.env.PRODUCTS_SERVICE_URL,
    "PRODUCTS_SERVICE_URL"
  )
}

export function getCategoriesServiceBaseUrl(): string {
  return requireJavaServiceBaseUrl(
    process.env.CATEGORIES_SERVICE_URL,
    "CATEGORIES_SERVICE_URL"
  )
}

export function getCollectionsServiceBaseUrl(): string {
  return requireJavaServiceBaseUrl(
    process.env.COLLECTIONS_SERVICE_URL,
    "COLLECTIONS_SERVICE_URL"
  )
}

export function getCartServiceBaseUrl(): string {
  return requireJavaServiceBaseUrl(
    process.env.CART_SERVICE_URL,
    "CART_SERVICE_URL"
  )
}
