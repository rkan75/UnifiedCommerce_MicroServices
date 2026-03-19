"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"

export const listCartShippingMethods = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        next,
        cache: "no-store",
      }
    )
    .then(({ shipping_options }) => {
      if (!shipping_options?.length) return shipping_options
      // Allow: Express, Delivery (dynamic fee), and Pickup (dynamic fee). Exclude other legacy options if desired.
      const name = (opt: { name?: string | null }) => (opt.name ?? "").toLowerCase()
      return shipping_options.filter((opt) => {
        const n = name(opt)
        if (n === "delivery" || n === "pickup") return true
        if (n.includes("express")) return true
        const isPickup = opt.service_zone?.fulfillment_set?.type === "pickup"
        if (isPickup) return false
        return n.includes("standard") || n.includes("express")
      })
    })
    .catch(() => {
      return null
    })
}

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
  }

  const body = { cart_id: cartId, data }

  if (data) {
    body.data = data
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: "POST",
        body,
        headers,
        next,
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch((e) => {
      return null
    })
}
