"use server"

import {
  getMedusaPublishableKeyHeaders,
  getProductsServiceBaseUrl,
} from "@lib/config/products-service"
import { HttpTypes } from "@medusajs/types"

import { getCacheOptions } from "./cookies"

export const retrieveVariant = async (
  variant_id: string
): Promise<HttpTypes.StoreProductVariant | null> => {
  const next = {
    ...(await getCacheOptions("variants")),
  }

  try {
    const base = getProductsServiceBaseUrl()
    const url = `${base}/store/product-variants/${encodeURIComponent(variant_id)}?fields=${encodeURIComponent("*images")}`
    const res = await fetch(url, {
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
