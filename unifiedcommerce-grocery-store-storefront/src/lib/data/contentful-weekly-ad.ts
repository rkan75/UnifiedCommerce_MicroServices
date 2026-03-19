import {
  CONTENTFUL_ACCESS_TOKEN,
  CONTENTFUL_ENVIRONMENT,
  CONTENTFUL_SPACE_ID,
  isContentfulConfigured,
} from "@lib/contentful/config"
import {
  MOCK_WEEKLY_AD,
  type WeeklyAd,
  type WeeklyAdDeal,
} from "@modules/home/components/weekly-ad/weekly-ad-data"
import { getProductByHandle, getProductsByIds } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"

const CONTENT_TYPE_WEEKLY_AD = "weeklyAd"
const CONTENT_TYPE_WEEKLY_AD_DEAL = "weeklyAdDeal"

/** Raw Contentful entry for a deal */
type ContentfulDealEntry = {
  sys: { id: string }
  fields: {
    title?: { [locale: string]: string }
    description?: { [locale: string]: string }
    category?: { [locale: string]: string }
    image?: {
      [locale: string]: {
        fields?: {
          file?: {
            url?: string
          }
        }
      }
    }
    productHandle?: { [locale: string]: string }
    productId?: { [locale: string]: string }
    validThrough?: { [locale: string]: string }
    // Optional: promotional text (e.g., "Save 30%", "Special Price")
    // Actual prices come from product database
    promotionalText?: { [locale: string]: string }
  }
}

/** Raw Contentful entry for weekly ad */
type ContentfulWeeklyAdEntry = {
  sys: { id: string }
  fields: {
    title?: { [locale: string]: string }
    description?: { [locale: string]: string }
    startDate?: { [locale: string]: string }
    endDate?: { [locale: string]: string }
    coverImage?: {
      [locale: string]: {
        fields?: {
          file?: {
            url?: string
          }
        }
      }
    }
    featuredDeals?: {
      [locale: string]: Array<{
        sys: { id: string; type: string; linkType?: string }
      }>
    }
  }
}

function getLocalizedValue(
  field: { [locale: string]: string } | undefined,
  locale: string = "en"
): string {
  if (!field || typeof field !== "object") return ""
  const normalizedLocale = locale.split("-")[0].toLowerCase()
  return (
    field[normalizedLocale] ??
    field[locale] ??
    field["en"] ??
    Object.values(field)[0] ??
    ""
  )
}

function getLocalizedImageUrl(
  imageField: {
    [locale: string]: {
      fields?: {
        file?: {
          url?: string
        }
      }
    }
  } | undefined,
  locale: string = "en"
): string | undefined {
  if (!imageField || typeof imageField !== "object") return undefined
  const normalizedLocale = locale.split("-")[0].toLowerCase()
  const imageData =
    imageField[normalizedLocale] ??
    imageField[locale] ??
    imageField["en"] ??
    Object.values(imageField)[0]

  const url = imageData?.fields?.file?.url
  return url ? `https:${url}` : undefined
}

/**
 * Parse deal entry from Contentful and enrich with product data from Medusa.
 * Prices are fetched from the product database, not from Contentful.
 */
async function parseDealEntry(
  entry: ContentfulDealEntry,
  countryCode: string,
  locale: string = "en"
): Promise<WeeklyAdDeal> {
  const fields = entry.fields
  const productHandle = getLocalizedValue(fields.productHandle, locale)
  const productId = getLocalizedValue(fields.productId, locale)
  
  let price = ""
  let wasPrice = ""
  let dealImage = getLocalizedImageUrl(fields.image, locale)

  // Fetch product from Medusa to get actual prices
  if (productHandle || productId) {
    try {
      let product = null
      
      if (productHandle) {
        product = await getProductByHandle(productHandle, countryCode)
      } else if (productId) {
        const productsMap = await getProductsByIds(countryCode, [productId])
        product = productsMap.get(productId) || null
      }

      if (product) {
        // Get price from product
        const priceData = getProductPrice({ product })
        
        if (priceData.cheapestPrice) {
          price = priceData.cheapestPrice.calculated_price || ""
          
          // Calculate wasPrice from original_price if different
          if (
            priceData.cheapestPrice.original_price &&
            priceData.cheapestPrice.original_price !== priceData.cheapestPrice.calculated_price
          ) {
            wasPrice = priceData.cheapestPrice.original_price
          }
        }

        // Use product image if Contentful image is not available
        if (!dealImage && product.thumbnail) {
          dealImage = product.thumbnail
        } else if (!dealImage && product.images?.[0]?.url) {
          dealImage = product.images[0].url
        }
      }
    } catch (error) {
      console.error(`[Contentful] Failed to fetch product for deal ${entry.sys.id}:`, error)
    }
  }

  // Fallback: Use Contentful title if product not found
  const dealTitle = getLocalizedValue(fields.title, locale)

  return {
    id: entry.sys.id,
    title: dealTitle,
    description: getLocalizedValue(fields.description, locale),
    price: price || "Price unavailable", // Fallback if product not found
    wasPrice: wasPrice || undefined,
    category: getLocalizedValue(fields.category, locale) || "Other",
    image: dealImage,
    validThrough: getLocalizedValue(fields.validThrough, locale),
    productHandle: productHandle || undefined,
  }
}

async function parseWeeklyAdEntry(
  entry: ContentfulWeeklyAdEntry,
  dealsMap: Map<string, WeeklyAdDeal>,
  locale: string = "en"
): Promise<WeeklyAd | null> {
  const fields = entry.fields
  const title = getLocalizedValue(fields.title, locale)
  const startDate = getLocalizedValue(fields.startDate, locale)
  const endDate = getLocalizedValue(fields.endDate, locale)

  if (!title || !startDate || !endDate) {
    return null
  }

  // Get featured deals - Contentful references are arrays of link objects
  let featuredDeals: WeeklyAdDeal[] = []
  const dealsField = fields.featuredDeals
  
  if (dealsField) {
    // Get the localized array of deal references
    const normalizedLocale = locale.split("-")[0].toLowerCase()
    const dealsRefs = 
      dealsField[normalizedLocale] ??
      dealsField[locale] ??
      dealsField["en"] ??
      Object.values(dealsField)[0] ??
      []

    if (Array.isArray(dealsRefs)) {
      featuredDeals = dealsRefs
        .map((ref: any) => {
          // Reference can be a link object { sys: { id: "...", type: "Link" } }
          // or already resolved entry object
          const dealId = ref?.sys?.id || ref
          if (typeof dealId === "string") {
            return dealsMap.get(dealId)
          }
          return null
        })
        .filter((deal): deal is WeeklyAdDeal => deal !== undefined)
    }
  }

  return {
    id: entry.sys.id,
    title,
    description: getLocalizedValue(fields.description, locale),
    startDate,
    endDate,
    coverImage: getLocalizedImageUrl(fields.coverImage, locale),
    featuredDeals,
  }
}

/**
 * Fetch all weekly ad deals from Contentful and enrich with product data
 */
async function fetchDeals(
  countryCode: string,
  locale: string = "en"
): Promise<Map<string, WeeklyAdDeal>> {
  const dealsMap = new Map<string, WeeklyAdDeal>()

  if (!isContentfulConfigured) return dealsMap

  const url = new URL(
    `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}/entries`
  )
  url.searchParams.set("access_token", CONTENTFUL_ACCESS_TOKEN)
  url.searchParams.set("content_type", CONTENT_TYPE_WEEKLY_AD_DEAL)
  url.searchParams.set("limit", "100")

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    })
    if (!res.ok) return dealsMap

    const data = (await res.json()) as {
      items?: ContentfulDealEntry[]
    }

    if (data.items) {
      // Parse all deals (with product data fetching)
      const dealPromises = data.items.map((item) => parseDealEntry(item, countryCode, locale))
      const deals = await Promise.all(dealPromises)
      
      for (let i = 0; i < deals.length; i++) {
        dealsMap.set(data.items[i].sys.id, deals[i])
      }
    }
  } catch (error) {
    console.error("[Contentful] Failed to fetch deals:", error)
  }

  return dealsMap
}

/**
 * Fetch weekly ad from Contentful.
 * Returns the most recent active weekly ad, or null if none found.
 * Falls back to mock data if Contentful is not configured or request fails.
 * 
 * Prices are fetched from Medusa product database, not from Contentful.
 */
export async function getWeeklyAd(
  countryCode: string = "us",
  locale: string = "en"
): Promise<WeeklyAd> {
  // Fallback to mock data if Contentful is not configured
  if (!isContentfulConfigured) {
    return MOCK_WEEKLY_AD
  }

  try {
    // Fetch all deals first (this will also fetch product prices from Medusa)
    const dealsMap = await fetchDeals(countryCode, locale)

    // Fetch weekly ad entries
    const url = new URL(
      `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}/entries`
    )
    url.searchParams.set("access_token", CONTENTFUL_ACCESS_TOKEN)
    url.searchParams.set("content_type", CONTENT_TYPE_WEEKLY_AD)
    url.searchParams.set("order", "-sys.createdAt") // Most recent first
    url.searchParams.set("limit", "10")
    url.searchParams.set("include", "2") // Include referenced entries (deals) up to 2 levels deep

    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      console.warn("[Contentful] Failed to fetch weekly ad, using mock data")
      return MOCK_WEEKLY_AD
    }

    const data = (await res.json()) as {
      items?: ContentfulWeeklyAdEntry[]
      includes?: {
        Entry?: ContentfulDealEntry[]
      }
    }

    // Also parse deals from includes if present
    if (data.includes?.Entry) {
      for (const entry of data.includes.Entry) {
        if (entry.sys.id && !dealsMap.has(entry.sys.id)) {
          const deal = await parseDealEntry(entry, countryCode, locale)
          dealsMap.set(entry.sys.id, deal)
        }
      }
    }

    // Find the most recent active weekly ad
    const now = new Date()
    let activeAd: WeeklyAd | null = null

    if (data.items) {
      // Parse all weekly ad entries
      const adPromises = data.items.map((item) => parseWeeklyAdEntry(item, dealsMap, locale))
      const ads = await Promise.all(adPromises)

      for (const ad of ads) {
        if (!ad) continue

        const startDate = new Date(ad.startDate)
        const endDate = new Date(ad.endDate)

        // Check if ad is currently active
        if (now >= startDate && now <= endDate) {
          activeAd = ad
          break
        }
      }

      // If no active ad found, use the most recent one
      if (!activeAd && ads.length > 0) {
        activeAd = ads.find((ad) => ad !== null) || null
      }
    }

    if (activeAd) {
      return activeAd
    }
  } catch (error) {
    console.error("[Contentful] Error fetching weekly ad:", error)
  }

  // Fallback to mock data
  return MOCK_WEEKLY_AD
}
