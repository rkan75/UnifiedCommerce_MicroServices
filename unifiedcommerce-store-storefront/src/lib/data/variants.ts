"use server"

import {
  getMedusaPublishableKeyHeaders,
  getProductsServiceBaseUrl,
} from "@lib/config/products-service"
import { fetchWithConnectionContext } from "@lib/util/fetch-with-connection-context"
import { HttpTypes } from "@medusajs/types"

export const retrieveVariant = async (
  variant_id: string
): Promise<HttpTypes.StoreProductVariant | null> => {
  const next = {
    revalidate: 120,
    tags: ["store-product-variants"],
  }

  try {
    const base = getProductsServiceBaseUrl()
    const url = `${base}/store/product-variants/${encodeURIComponent(variant_id)}?fields=${encodeURIComponent("*images")}`
    const res = await fetchWithConnectionContext(url, {
      method: "GET",
      headers: getMedusaPublishableKeyHeaders(),
      next,
      cache: "force-cache",
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      variant?: HttpTypes.StoreProductVariant
    }
    return data.variant ?? null
  } catch {
    return null
  }
}
