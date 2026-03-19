"use client"

import { algoliasearch } from "algoliasearch"
import { createNullCache } from "@algolia/client-common"

// Trim in case .env has accidental spaces (Next inlines these at build time)
const algoliaAppId = (process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "").trim()
const algoliaSearchKey = (process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY || "").trim()

// Algolia is optional; search falls back to non-Algolia when not configured
if (!algoliaAppId || !algoliaSearchKey) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[Algolia] Not configured. Set NEXT_PUBLIC_ALGOLIA_APP_ID and NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY in .env.local, then restart the dev server (./restart-dev.sh)."
    )
  }
} else if (process.env.NODE_ENV === "development") {
  console.info("[Algolia] Configured. Header search will use Algolia. Index:", (process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "products").trim())
}

let searchClient: ReturnType<typeof algoliasearch> | null = null

if (algoliaAppId && algoliaSearchKey) {
  try {
    searchClient = algoliasearch(algoliaAppId, algoliaSearchKey, {
      // Use no-op caches so the client never calls .get on undefined (avoids runtime error)
      responsesCache: createNullCache(),
      requestsCache: createNullCache(),
    })
    
    // Wrap the search method so referer/API errors are rethrown and AlgoliaSearch can show FallbackSearch
    if (searchClient) {
      const originalSearch = searchClient.search.bind(searchClient)
      searchClient.search = async function (requests: any[]) {
        try {
          return await originalSearch(requests)
        } catch (error: any) {
          if (
            error?.message?.includes("referer") ||
            error?.message?.includes("Method not allowed") ||
            error?.status === 403 ||
            error?.status === 401
          ) {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "[Algolia] Search blocked (referer/API restrictions). Add your origin to allowed referers in Algolia Dashboard → Settings → API Keys. Showing fallback search."
              )
            }
            // Rethrow so AlgoliaSearch can set hasError and render FallbackSearch
            throw error
          }
          throw error
        }
      }
    }
  } catch (error) {
    console.error("[Algolia] Failed to initialize search client:", error)
    searchClient = null
  }
}

export { searchClient }

export const ALGOLIA_INDEX_NAME = (process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "products").trim()

export const isAlgoliaConfigured = !!searchClient
