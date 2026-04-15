import { normalizeLocalhostForServerFetch } from "@lib/util/normalize-localhost-service-url"

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
  return normalizeLocalhostForServerFetch(raw.replace(/\/$/, ""))
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

/**
 * Java cart-service only — Medusa {@code /store/carts} is disabled in this project (410).
 * Local default port 8083; start with {@code cart-service/restart-dev.sh}.
 */
export function getCartServiceBaseUrl(): string {
  return requireJavaServiceBaseUrl(
    process.env.CART_SERVICE_URL,
    "CART_SERVICE_URL"
  )
}

/**
 * Ordered bases for GET /store/regions (and single-region GET): try Java first when set, then Medusa.
 * Lets the storefront recover when regions-service is down but Medusa still serves regions.
 */
export function getRegionsApiBaseUrlCandidates(): string[] {
  const out: string[] = []
  const push = (raw?: string) => {
    const t = raw?.trim()
    if (!t) return
    const n = normalizeLocalhostForServerFetch(t.replace(/\/$/, ""))
    if (!out.includes(n)) out.push(n)
  }
  push(process.env.REGIONS_SERVICE_URL)
  push(process.env.MEDUSA_BACKEND_URL)
  if (out.length === 0) {
    push("http://localhost:9000")
  }
  return out
}

/**
 * Primary base for region API — first candidate (Java when {@code REGIONS_SERVICE_URL} is set).
 */
export function getRegionsApiBaseUrl(): string {
  const c = getRegionsApiBaseUrlCandidates()
  return c[0] ?? normalizeLocalhostForServerFetch("http://localhost:9000")
}
