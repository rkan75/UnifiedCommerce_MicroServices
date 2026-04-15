import { getRegionsApiBaseUrlCandidates } from "@lib/config/products-service"
import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  const candidates = getRegionsApiBaseUrlCandidates()
  if (candidates.length === 0) {
    throw new Error(
      "Middleware.ts: Cannot fetch /store/regions. Set REGIONS_SERVICE_URL and/or MEDUSA_BACKEND_URL."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Edge: no JS SDK — try Java regions-service first, then Medusa (same order as server regions.ts).
    let lastError: unknown
    let loaded = false
    for (const base of candidates) {
      try {
        const response = await fetch(`${base}/store/regions`, {
          headers: {
            "x-publishable-api-key": PUBLISHABLE_API_KEY || "",
          },
          cache: "no-store",
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = `Failed to fetch regions: ${response.status} ${response.statusText}`
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.message || errorMessage
          } catch {
            if (errorText) errorMessage = errorText
          }
          throw new Error(`${errorMessage} (${base})`)
        }

        const json = (await response.json()) as { regions?: HttpTypes.StoreRegion[] }
        const regions = json.regions

        if (!regions?.length) {
          throw new Error(`No regions in response from ${base}`)
        }

        regionMapCache.regionMap.clear()
        regions.forEach((region: HttpTypes.StoreRegion) => {
          region.countries?.forEach((c) => {
            const iso = (c?.iso_2 ?? "").trim().toLowerCase()
            if (iso) regionMapCache.regionMap.set(iso, region)
          })
        })

        if (regionMapCache.regionMap.size === 0) {
          const r = regions[0]
          if (r) {
            regionMapCache.regionMap.set(DEFAULT_REGION.toLowerCase(), r)
          }
        }

        regionMapCache.regionMapUpdated = Date.now()
        loaded = true
        break
      } catch (error) {
        lastError = error
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[middleware] GET /store/regions failed for ${base}; trying next source if any:`,
            error
          )
        }
      }
    }

    if (!loaded) {
      if (process.env.NODE_ENV === "development") {
        console.error("Middleware.ts: All region sources failed. Last error:", lastError)
        console.error(
          `Tried: ${candidates.join(", ")} — Publishable Key: ${PUBLISHABLE_API_KEY ? "Set" : "Not set"}`
        )
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("Could not load regions from any configured URL")
    }
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number> | null
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    // If regionMap is empty (backend unavailable), use URL country code or default
    if (!regionMap || regionMap.size === 0) {
      // If URL already has a country code, use it (allow through)
      if (urlCountryCode && urlCountryCode.length === 2) {
        return urlCountryCode
      }
      // Otherwise use default region
      return DEFAULT_REGION
    }

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
    // Fallback to default region on error
    return DEFAULT_REGION
  }
}

/**
 * Cloud Run decodes URL paths before forwarding; Next.js 15 encodes @ in parallel
 * routes as %40. Re-encode @ to %40 so chunk requests succeed (see Next.js #71626).
 */
function rewriteChunkPathForCloudRun(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname
  if (
    !pathname.startsWith("/_next/static/chunks/") ||
    !pathname.includes("@")
  ) {
    return null
  }
  const rewritten = pathname.replace(/@/g, "%40")
  const url = new URL(request.url)
  url.pathname = rewritten
  return NextResponse.rewrite(url)
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  // Handle _next/static requests: rewrite @ to %40 for Cloud Run, or pass through
  if (request.nextUrl.pathname.startsWith("/_next/static/")) {
    const chunkRewrite = rewriteChunkPathForCloudRun(request)
    return chunkRewrite ?? NextResponse.next()
  }

  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  let regionMap: Map<string, HttpTypes.StoreRegion> | null = null
  try {
    regionMap = await getRegionMap(cacheId)
  } catch (error) {
    // If backend is unavailable, log error and use fallback
    if (process.env.NODE_ENV === "development") {
      console.error("Middleware.ts: Failed to fetch regions:", error)
      console.error(
        "Make sure regions are reachable (REGIONS_SERVICE_URL and/or MEDUSA_BACKEND_URL):",
        getRegionsApiBaseUrlCandidates().join(" → ")
      )
    }
    // Use empty map - will fall back to DEFAULT_REGION or URL-based detection
    regionMap = new Map()
  }

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1].includes(countryCode)

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  // if one of the country codes is in the url and the cache id is not set, set the cache id and redirect
  if (urlHasCountryCode && !cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return response
  }

  // check if the url is a static asset
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  } else if (!urlHasCountryCode && !countryCode) {
    // Handle case where no valid country code exists (empty regions)
    return new NextResponse(
      "No valid regions configured. Please set up regions with countries in your Medusa Admin.",
      { status: 500 }
    )
  }

  return response
}

export const config = {
  matcher: [
    // Region redirect: exclude static assets except chunks (chunks need @ encoding fix)
    "/((?!api|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
    // Chunks: must run for Cloud Run @/%40 workaround (Next.js #71626)
    "/_next/static/chunks/:path*",
  ],
}
