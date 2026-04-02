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
    const cartHint =
      isCart &&
      (cause.includes("ECONNREFUSED") ||
        base.includes("ECONNREFUSED") ||
        cause.includes("refused"))
        ? "\n  Cart API is only provided by Java cart-service (not Medusa). Start it from the repo root sibling: cd cart-service && ./restart-dev.sh\n  Ensure CART_SERVICE_URL in .env.local matches (default http://127.0.0.1:8083 or http://localhost:8083)."
        : ""
    const hint =
      cartHint !== ""
        ? cartHint.trim()
        : url.includes("127.0.0.1") || url.includes("host.docker.internal")
          ? "Ensure the service is running and the port in the URL is correct."
          : "If this is local dev, try replacing `localhost` with `127.0.0.1` in the service URL env vars, and ensure the service is running."
    throw new Error(
      `Server fetch failed: ${base}${cause ? ` (${cause})` : ""}\n  URL: ${url}\n  ${hint}`
    )
  }
}
