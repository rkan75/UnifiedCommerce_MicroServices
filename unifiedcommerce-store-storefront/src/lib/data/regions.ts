"use server"

import {
  getMedusaPublishableKeyHeaders,
  getRegionsApiBaseUrlCandidates,
} from "@lib/config/products-service"
import storeApiError from "@lib/util/store-api-error"
import { fetchWithConnectionContext } from "@lib/util/fetch-with-connection-context"
import { HttpTypes } from "@medusajs/types"
import { cache } from "react"
import { getCacheOptions } from "./cookies"

function countryIso2(c: unknown): string {
  if (!c || typeof c !== "object") return ""
  const o = c as Record<string, unknown>
  const s =
    (typeof o.iso_2 === "string" && o.iso_2) ||
    (typeof o.iso2 === "string" && o.iso2) ||
    (typeof o.code === "string" && o.code)
  return String(s).trim().toLowerCase()
}

async function fetchRegionsListOnce(
  base: string,
  next: Record<string, unknown>
): Promise<HttpTypes.StoreRegion[]> {
  const url = `${base}/store/regions`
  const res = await fetchWithConnectionContext(url, {
    method: "GET",
    headers: getMedusaPublishableKeyHeaders(),
    next,
    cache: "force-cache",
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(
      `GET /store/regions failed at ${base}: ${res.status} ${t.slice(0, 200)}`
    )
  }
  const json = (await res.json()) as { regions?: HttpTypes.StoreRegion[] }
  return json.regions ?? []
}

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  const bases = getRegionsApiBaseUrlCandidates()
  let lastErr: unknown
  for (const base of bases) {
    try {
      return await fetchRegionsListOnce(base, next)
    } catch (err) {
      lastErr = err
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[regions] GET /store/regions failed for ${base}; trying next source if available:`,
          err instanceof Error ? err.message : err
        )
      }
    }
  }
  storeApiError(lastErr ?? new Error("No regions source responded"))
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  const bases = getRegionsApiBaseUrlCandidates()
  let lastErr: unknown
  for (const base of bases) {
    try {
      const url = `${base}/store/regions/${encodeURIComponent(id)}`
      const res = await fetchWithConnectionContext(url, {
        method: "GET",
        headers: getMedusaPublishableKeyHeaders(),
        next,
        cache: "force-cache",
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(
          `GET /store/regions/${id} failed at ${base}: ${res.status} ${t.slice(0, 200)}`
        )
      }
      const json = (await res.json()) as { region?: HttpTypes.StoreRegion }
      return json.region ?? null
    } catch (err) {
      lastErr = err
    }
  }
  storeApiError(lastErr ?? new Error("Region not found"))
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

function defaultRegionCountryCode(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_REGION?.trim().toLowerCase() || "us"
}

function resolveRegionFromMap(
  countryCode: string
): HttpTypes.StoreRegion | undefined {
  const code = countryCode.trim().toLowerCase()
  const direct = code ? regionMap.get(code) : regionMap.get(defaultRegionCountryCode())
  if (direct) return direct

  const fallback = regionMap.get(defaultRegionCountryCode())
  if (fallback) return fallback

  if (regionMap.size > 0) {
    return regionMap.values().next().value as HttpTypes.StoreRegion | undefined
  }
  return undefined
}

/** Dedupe region resolution within a single RSC tree (many listProducts calls share one listRegions). */
export const getRegion = cache(async function getRegion(
  countryCode: string
): Promise<HttpTypes.StoreRegion | null | undefined> {
  try {
    if (regionMap.size > 0) {
      return resolveRegionFromMap(countryCode) ?? null
    }

    const regions = await listRegions()

    if (!regions.length) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        const iso = countryIso2(c)
        if (iso) regionMap.set(iso, region)
      })
    })

    /** Java DTOs sometimes omit `countries`; still map a region for pricing + locale. */
    if (regionMap.size === 0 && regions.length > 0) {
      const r = regions[0]!
      const def = defaultRegionCountryCode()
      regionMap.set(def, r)
      const cc = countryCode.trim().toLowerCase()
      if (cc && cc !== def) {
        regionMap.set(cc, r)
      }
    }

    return resolveRegionFromMap(countryCode) ?? null
  } catch (e: any) {
    return null
  }
})
