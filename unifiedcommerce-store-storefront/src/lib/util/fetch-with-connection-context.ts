/**
 * Wraps `fetch` so connection failures include the URL and common remediation (localhost → 127.0.0.1).
 */
export async function fetchWithConnectionContext(
  url: string,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err)
    let cause = ""
    if (err instanceof Error && err.cause != null) {
      if (err.cause instanceof Error) {
        cause = err.cause.message
      } else if (typeof err.cause === "object" && "code" in err.cause) {
        cause = String((err.cause as { code?: string }).code ?? "")
      }
    }
    const isCart = url.includes("/store/carts")
    const isCollections = url.includes("/store/collections")
    const refused =
      cause.includes("ECONNREFUSED") ||
      base.includes("ECONNREFUSED") ||
      cause.includes("refused")
    const cartHint =
      isCart && refused
        ? "\n  Cart API is only provided by Java cart-service (not Medusa). Start it from the repo root sibling: cd cart-service && ./restart-dev.sh\n  Ensure CART_SERVICE_URL in .env.local matches (default http://127.0.0.1:8083 or http://localhost:8083)."
        : ""
    const collectionsHint =
      isCollections && refused
        ? "\n  Collections are served by Java collections-service (default port 8086). From the repo: cd collections-service && ./restart-dev.sh\n  Or set COLLECTIONS_SERVICE_URL in .env.local. In development the storefront falls back to Medusa automatically when the service is down; in production set COLLECTIONS_FALLBACK_TO_MEDUSA=true or start collections-service."
        : ""
    const hint =
      cartHint !== ""
        ? cartHint.trim()
        : collectionsHint !== ""
          ? collectionsHint.trim()
          : url.includes("127.0.0.1") || url.includes("host.docker.internal")
          ? "Ensure the service is running and the port in the URL is correct."
          : "If this is local dev, try replacing `localhost` with `127.0.0.1` in the service URL env vars, and ensure the service is running."
    throw new Error(
      `Server fetch failed: ${base}${cause ? ` (${cause})` : ""}\n  URL: ${url}\n  ${hint}`
    )
  }
}
