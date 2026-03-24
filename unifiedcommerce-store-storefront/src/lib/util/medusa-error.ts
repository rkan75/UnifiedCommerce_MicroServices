function formatMessage(raw: unknown): string {
  if (raw == null) return ""
  if (typeof raw === "string") return raw.trim()
  if (typeof raw === "object" && raw !== null && "message" in raw) {
    const m = (raw as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m.trim()
  }
  try {
    return JSON.stringify(raw)
  } catch {
    return String(raw)
  }
}

function capitalizeSentence(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith(".") ? "" : ".")
}

function isLikelySdkFetchError(error: unknown): error is Error & {
  status: number
  statusText?: string
} {
  if (error == null || typeof error !== "object") return false
  const e = error as Record<string, unknown>
  const status = e.status
  // @medusajs/js-sdk throws FetchError for HTTP status >= 300; avoid matching random `.status` numbers
  if (typeof status !== "number" || !Number.isFinite(status) || status < 300) {
    return false
  }
  return error instanceof Error
}

/**
 * Normalizes errors from @medusajs/js-sdk (FetchError), axios-style clients, and plain Errors.
 */
export default function medusaError(error: any): never {
  // @medusajs/js-sdk: non-2xx responses throw FetchError { message, status, statusText }
  if (isLikelySdkFetchError(error)) {
    const msg =
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : typeof error.statusText === "string" && error.statusText.trim()
          ? error.statusText.trim()
          : `Request failed with status ${error.status}`

    // Avoid console.error here — Next.js dev overlay reports it as a "Console Error".
    if (process.env.NODE_ENV === "development") {
      const detail = [
        `HTTP ${error.status}`,
        error.statusText ? String(error.statusText) : null,
        msg !== `Request failed with status ${error.status}` ? msg : null,
      ]
        .filter(Boolean)
        .join(" — ")
      console.warn("[Medusa SDK]", detail)
    }

    throw new Error(capitalizeSentence(`${msg} (HTTP ${error.status})`))
  }

  if (error?.response) {
    const u = new URL(error.config.url, error.config.baseURL)
    console.error("Resource:", u.toString())
    console.error("Response data:", error.response.data)
    console.error("Status code:", error.response.status)
    console.error("Headers:", error.response.headers)

    const raw = error.response.data?.message ?? error.response.data
    const message = formatMessage(raw) || `HTTP ${error.response.status}`

    throw new Error(capitalizeSentence(message))
  }

  if (error?.request) {
    throw new Error(
      "No response from the store API. Is the Medusa backend running and MEDUSA_BACKEND_URL correct?"
    )
  }

  const base =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : formatMessage(error) || "Unknown error"

  if (process.env.NODE_ENV === "development") {
    console.warn("[Medusa request]", error instanceof Error ? error.message : String(error))
  }

  throw new Error(
    capitalizeSentence(
      base.includes("fetch") || base.includes("ECONNREFUSED")
        ? `Cannot reach the store API: ${base}`
        : base
    )
  )
}
