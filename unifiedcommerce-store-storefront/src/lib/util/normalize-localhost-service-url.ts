/**
 * Node's undici `fetch` often fails with a bare `TypeError: fetch failed` when the URL host is
 * `localhost` but the service binds only to IPv4 (127.0.0.1): some systems resolve `localhost` to
 * `::1` first, so the connection is refused.
 *
 * Use on server-side base URLs only (not for browser-relative URLs).
 */
export function normalizeLocalhostForServerFetch(url: string): string {
  const t = url.trim()
  if (!t) return t
  try {
    const u = new URL(t)
    if (u.hostname === "localhost") {
      u.hostname = "127.0.0.1"
    }
    // `URL#toString()` often appends a trailing "/" for origin-only URLs (e.g. http://host:8086/).
    // Concatenating `${base}/store/...` would then produce //store/... and the backend returns 404.
    return u.toString().replace(/\/+$/, "")
  } catch {
    return t.replace(/\/+$/, "")
  }
}
