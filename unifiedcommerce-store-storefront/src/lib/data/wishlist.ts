"use server"

import { getProductsServiceBaseUrl } from "@lib/config/products-service"
import { cache } from "react"
import { getAuthHeaders } from "./cookies"

const getMedusaBackendUrl = () => {
  return process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
}

const PUBLISHABLE_KEY_HEADER = "x-publishable-api-key"

/** Headers required for store API: auth (if logged in) + publishable key */
async function getStoreRequestHeaders(): Promise<Record<string, string>> {
  const publishableKey =
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(publishableKey ? { [PUBLISHABLE_KEY_HEADER]: publishableKey } : {}),
  }
  const auth = await getAuthHeaders()
  if ("authorization" in auth && auth.authorization) {
    headers["authorization"] = auth.authorization
  }
  return headers
}

/**
 * Fetches product_id for a variant from the store API (used when order items don't include it).
 */
export async function getProductIdByVariantId(
  variantId: string
): Promise<string | null> {
  const headers = await getStoreRequestHeaders()
  try {
    const res = await fetch(
      `${getProductsServiceBaseUrl()}/store/product-variants/${encodeURIComponent(variantId)}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      variant?: { product_id?: string; product?: { id?: string } }
    }
    const variant = data?.variant
    return variant?.product_id ?? variant?.product?.id ?? null
  } catch {
    return null
  }
}

export type WishlistItem = {
  id: string
  product_id: string
  product_variant_id: string
  quantity: number
  product?: { id: string; title: string; handle?: string; thumbnail?: string }
  variant?: { id: string; title: string }
}

export type WishlistResponse = {
  wishlist?: {
    id: string
    items?: WishlistItem[]
  }
}

/** Raw item from API may use snake_case or camelCase */
type RawWishlistItem = {
  id?: string
  product_id?: string
  product_variant_id?: string
  productId?: string
  productVariantId?: string
  quantity?: number
  product?: { id: string; title: string; handle?: string; thumbnail?: string }
  variant?: { id: string; title: string }
}

function normalizeWishlistItem(raw: RawWishlistItem): WishlistItem | null {
  const productId =
    raw.product_id ?? raw.productId ?? ""
  const variantId =
    raw.product_variant_id ?? raw.productVariantId ?? ""
  if (!productId || !variantId) return null
  return {
    id: raw.id ?? `${productId}-${variantId}`,
    product_id: productId,
    product_variant_id: variantId,
    quantity: raw.quantity ?? 1,
    product: raw.product,
    variant: raw.variant,
  }
}

/**
 * Fetches the current customer's wishlist from the backend.
 * Normalizes item fields (supports both snake_case and camelCase from API).
 * Requires the customer to be logged in (store JWT).
 */
async function getWishlistUncached(): Promise<WishlistResponse | null> {
  const auth = await getAuthHeaders()
  if (!("authorization" in auth) || !auth.authorization) {
    return null
  }
  const headers = await getStoreRequestHeaders()
  try {
    const res = await fetch(`${getMedusaBackendUrl()}/store/customers/me/wishlist`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      wishlist?: { id?: string; items?: RawWishlistItem[] }
    }
    const rawItems = data?.wishlist?.items ?? []
    const items: WishlistItem[] = rawItems
      .map(normalizeWishlistItem)
      .filter((item): item is WishlistItem => item !== null)
    return {
      wishlist: {
        id: data.wishlist?.id ?? "",
        items,
      },
    }
  } catch {
    return null
  }
}

/** Dedupes layout + home (or other RSC) in the same request. */
export const getWishlist = cache(getWishlistUncached)

/**
 * Adds or updates an item in the customer's wishlist.
 * Requires the customer to be logged in.
 */
export async function addToWishlist(
  productId: string,
  productVariantId: string,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> {
  const auth = await getAuthHeaders()
  if (!("authorization" in auth) || !auth.authorization) {
    return { success: false, error: "Not logged in" }
  }
  const headers = await getStoreRequestHeaders()
  try {
    const res = await fetch(
      `${getMedusaBackendUrl()}/store/customers/me/wishlist/items`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId,
          productVariantId,
          quantity,
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        success: false,
        error: (err as { message?: string }).message || res.statusText,
      }
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to add to wishlist",
    }
  }
}

/**
 * Adds an item to the wishlist by variant_id. Resolves product_id from the store API if not provided.
 * Use this when adding from past purchases so it works even when order items don't include product_id.
 */
export async function addToWishlistByVariant(
  variantId: string,
  productId?: string | null,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> {
  let pid = productId ?? null
  if (!pid) {
    pid = await getProductIdByVariantId(variantId)
  }
  if (!pid) {
    return { success: false, error: "Could not resolve product for this item." }
  }
  return addToWishlist(pid, variantId, quantity)
}

/**
 * Removes an item from the customer's wishlist.
 * Requires the customer to be logged in.
 */
export async function removeFromWishlist(
  productId: string,
  productVariantId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await getAuthHeaders()
  if (!("authorization" in auth) || !auth.authorization) {
    return { success: false, error: "Not logged in" }
  }
  const headers = await getStoreRequestHeaders()
  try {
    const url = new URL(
      `${getMedusaBackendUrl()}/store/customers/me/wishlist/items`
    )
    url.searchParams.set("productId", productId)
    url.searchParams.set("productVariantId", productVariantId)
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        success: false,
        error: (err as { message?: string }).message || res.statusText,
      }
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e.message : "Failed to remove from wishlist",
    }
  }
}

/**
 * Removes an item from the wishlist by variant_id. Resolves product_id when not provided.
 */
export async function removeFromWishlistByVariant(
  variantId: string,
  productId?: string | null
): Promise<{ success: boolean; error?: string }> {
  let pid = productId ?? null
  if (!pid) {
    pid = await getProductIdByVariantId(variantId)
  }
  if (!pid) {
    return { success: false, error: "Could not resolve product for this item." }
  }
  return removeFromWishlist(pid, variantId)
}
