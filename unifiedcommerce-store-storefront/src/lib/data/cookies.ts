import "server-only"
import type { HeaderFulfillmentPreference } from "@lib/config/checkout-method-options"
import { HEADER_FULFILLMENT_COOKIE } from "@lib/config/checkout-method-options"
import { cookies as nextCookies } from "next/headers"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies()
    const cacheId = cookies.get("_medusa_cache_id")?.value

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch (error) {
    return ""
  }
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {}
  }

  const cacheTag = await getCacheTag(tag)

  if (!cacheTag) {
    return {}
  }

  return { tags: [`${cacheTag}`] }
}

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", cartId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", "", {
    path: "/",
    maxAge: -1,
  })
}

const DELIVERY_ZIP_COOKIE = "_medusa_delivery_zip"

export const getDeliveryZip = async (): Promise<string | undefined> => {
  try {
    const cookies = await nextCookies()
    return cookies.get(DELIVERY_ZIP_COOKIE)?.value
  } catch {
    return undefined
  }
}

export const setDeliveryZip = async (postalCode: string) => {
  const cookies = await nextCookies()
  cookies.set(DELIVERY_ZIP_COOKIE, postalCode, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // allow client read for display if needed
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}

export async function getHeaderFulfillmentCookie(): Promise<HeaderFulfillmentPreference | null> {
  try {
    const cookies = await nextCookies()
    const v = cookies.get(HEADER_FULFILLMENT_COOKIE)?.value
    if (v === "in_store" || v === "pickup" || v === "delivery") return v
    return null
  } catch {
    return null
  }
}
