// Fix broken localStorage before SDK initialization
// Node.js with --localstorage-file can create a broken localStorage
if (typeof globalThis !== "undefined") {
  try {
    const globalObj = globalThis as any
    
    // Check if window exists and has broken localStorage
    if (globalObj.window?.localStorage) {
      try {
        if (typeof globalObj.window.localStorage.getItem !== "function") {
          delete globalObj.window.localStorage
        }
      } catch {
        try {
          delete globalObj.window.localStorage
        } catch {
          // Ignore
        }
      }
    }
    
    // Also check globalThis directly
    if (globalObj.localStorage && typeof globalObj.localStorage.getItem !== "function") {
      try {
        delete globalObj.localStorage
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore all errors
  }
}

import { getLocaleHeader } from "@lib/util/get-locale-header"
import { normalizeLocalhostForServerFetch } from "@lib/util/normalize-localhost-service-url"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

const PUBLISHABLE_KEY_SETUP_MESSAGE =
  "Set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in your environment (e.g. .env.local)."

export class PublishableKeySetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PublishableKeySetupError"
  }
}

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = normalizeLocalhostForServerFetch("http://localhost:9000")

if (process.env.MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = normalizeLocalhostForServerFetch(
    process.env.MEDUSA_BACKEND_URL.trim()
  )
}

const publishableKey = (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "").trim()

if (process.env.NODE_ENV === "development" && !publishableKey) {
  console.error("[Storefront] " + PUBLISHABLE_KEY_SETUP_MESSAGE)
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: publishableKey || undefined,
  auth: {
    // Use memory storage on server-side to avoid localStorage errors
    jwtTokenStorageMethod: typeof window === "undefined" ? "memory" : "local",
  },
})

// Override locale getter to prevent localStorage access errors
// This ensures the SDK doesn't try to access localStorage if it's broken
Object.defineProperty(sdk.client, "locale", {
  get() {
    // Always try to use locale_ first (set during initialization)
    if (this.locale_) {
      return this.locale_
    }
    
    // Only try localStorage if we're in a browser and it's functional
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
      try {
        const storedLocale = window.localStorage.getItem("medusa_locale")
        if (storedLocale) {
          return storedLocale
        }
      } catch {
        // If localStorage access fails, fall back to empty string
      }
    }
    
    return ""
  },
  configurable: true,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader?.["x-medusa-locale"]
  } catch {
    // Swallow DYNAMIC_SERVER_USAGE etc. - locale header is optional
  }

  const newHeaders = {
    ...(localeHeader ?? {}),
    ...headers,
  }
  init = {
    ...init,
    headers: newHeaders,
  }

  try {
    return await originalFetch(input, init)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      typeof message === "string" &&
      message.toLowerCase().includes("publishable key")
    ) {
      throw new PublishableKeySetupError(
        "Backend requires a valid publishable API key. " + PUBLISHABLE_KEY_SETUP_MESSAGE
      )
    }
    throw err
  }
}
