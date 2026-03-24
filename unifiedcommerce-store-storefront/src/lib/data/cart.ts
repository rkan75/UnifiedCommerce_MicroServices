"use server"

import { sdk } from "@lib/config"
import { parseSubscribeSaveFromLineMetadata } from "@lib/config/subscribe-save-metadata"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  getDeliveryZip,
  removeCartId,
  setCartId,
  setDeliveryZip,
} from "./cookies"
import { getRegion } from "./regions"
import { getLocale } from "@lib/data/locale-actions"

const DEFAULT_CART_FIELDS =
  "*items, *region, *items.product, *items.product.categories, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name, +metadata"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string, fields?: string) {
  const id = cartId || (await getCartId())
  fields ??= DEFAULT_CART_FIELDS

  if (!id) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        fields,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

/**
 * Live cart for client refresh (mini-cart, /api/cart). Do not use Next.js Data Cache here —
 * `retrieveCart` uses force-cache so refetches after add-to-cart can return stale line items.
 */
export async function retrieveCartLive(
  cartId?: string,
  fields: string = DEFAULT_CART_FIELDS
) {
  const id = cartId || (await getCartId())
  if (!id) {
    return null
  }
  const headers = {
    ...(await getAuthHeaders()),
  }
  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: { fields },
      headers,
      cache: "no-store",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id")

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers
    )
    cart = cartResp.cart

    await setCartId(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

const DELIVERY_STORE_META_KEYS = [
  "delivery_store_id",
  "delivery_store_name",
  "delivery_store_address",
] as const

/**
 * Updates the delivery location (zip code) for the header.
 * Updates cart shipping_address when cart exists; always sets delivery_zip cookie.
 * Optionally sets or clears `delivery_store_*` cart metadata (merged with existing metadata).
 */
export async function updateDeliveryZip(
  countryCode: string,
  postalCode: string,
  fulfillmentStore?: {
    id: string
    name: string
    address: string
    city: string
    state: string
    zip: string
  } | null
): Promise<{ success: boolean; error?: string }> {
  const trimmedZip = (postalCode || "").trim()
  if (!trimmedZip) {
    return { success: false, error: "Please enter a zip code." }
  }

  const cartId = await getCartId()
  if (cartId) {
    const minimalAddress = {
      first_name: "—",
      last_name: "—",
      address_1: "—",
      city: "—",
      postal_code: trimmedZip,
      country_code: countryCode,
      province: "",
      phone: "",
      company: "",
    }
    try {
      const live = await retrieveCartLive(cartId)
      const prevMeta = { ...((live?.metadata ?? {}) as Record<string, unknown>) }
      if (fulfillmentStore) {
        prevMeta.delivery_store_id = fulfillmentStore.id
        prevMeta.delivery_store_name = fulfillmentStore.name
        prevMeta.delivery_store_address = `${fulfillmentStore.address}, ${fulfillmentStore.city}, ${fulfillmentStore.state} ${fulfillmentStore.zip}`
      } else {
        for (const k of DELIVERY_STORE_META_KEYS) {
          delete prevMeta[k]
        }
      }
      await sdk.store.cart.update(
        cartId,
        {
          shipping_address: minimalAddress as any,
          metadata: prevMeta,
        },
        {},
        await getAuthHeaders()
      )
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    } catch (e: any) {
      // Still set cookie so header can show the zip
    }
  }
  await setDeliveryZip(trimmedZip)
  return { success: true }
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  lineItemMetadata,
}: {
  variantId: string
  quantity: number
  countryCode: string
  /** Stored on the cart line and carried to the order line for subscribe & save / fulfillment rules. */
  lineItemMetadata?: Record<string, unknown>
}) {
  const trimmedVariantId = (variantId ?? "").trim()
  if (!trimmedVariantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const qty = Math.max(1, Math.round(Number(quantity)) || 1)

  const headers = {
    ...(await getAuthHeaders()),
  }

  const lineBody: {
    variant_id: string
    quantity: number
    metadata?: Record<string, unknown>
  } = {
    variant_id: trimmedVariantId,
    quantity: qty,
  }
  if (lineItemMetadata && Object.keys(lineItemMetadata).length > 0) {
    lineBody.metadata = lineItemMetadata
  }

  await sdk.store.cart
    .createLineItem(cart.id, lineBody, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  quantity,
  metadata,
}: {
  lineId: string
  quantity: number
  metadata?: Record<string, unknown>
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const body: { quantity: number; metadata?: Record<string, unknown> } = {
    quantity,
  }
  if (metadata !== undefined) {
    body.metadata = metadata
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, body, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    return e.message
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      email: formData.get("email"),
    } as any

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address

    if (sameAsBilling !== "on")
      data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: formData.get("billing_address.phone"),
      }
    await updateCart(data)
  } catch (e: any) {
    return e.message
  }

  redirect(
    `/${formData.get("shipping_address.country_code")}/checkout?step=delivery`
  )
}

export type DeliveryAddressInput = {
  first_name: string
  last_name: string
  address_1: string
  city: string
  postal_code: string
  country_code: string
  province?: string
  phone?: string
  company?: string
}

export type DeliveryStoreInput = {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}

export type DeliverySlotInput = {
  slotId: string
  dateLabel: string
  startTime: string
  endTime: string
  /** ISO date string for the slot date */
  dateIso: string
}

export type PickupSlotInput = {
  slotId: string
  dateLabel: string
  startTime: string
  endTime: string
  dateIso: string
}

const PICKUP_SLOT_META_KEYS = [
  "pickup_slot_id",
  "pickup_slot_date_label",
  "pickup_slot_start",
  "pickup_slot_end",
  "pickup_slot_date_iso",
] as const

/** Medusa often returns no `/store/shipping-options` until the cart has a postal code + country. */
const DEFAULT_FALLBACK_ZIP_US = "10001"

/**
 * Sets a minimal shipping (and billing) address on the cart when missing, so fulfillment
 * can resolve shipping options. Uses header delivery ZIP cookie when set.
 */
export async function ensureMinimalShippingAddressForShippingOptions(
  cartId: string,
  countryCode: string
): Promise<void> {
  const live = await retrieveCartLive(cartId)
  if (!live) return
  const pc = live.shipping_address?.postal_code
  if (pc != null && String(pc).trim().length >= 3) {
    return
  }
  const cc = (countryCode || "us").toLowerCase()
  const zipFromCookie = (await getDeliveryZip())?.trim()
  const postal =
    zipFromCookie ||
    (cc === "us" ? DEFAULT_FALLBACK_ZIP_US : DEFAULT_FALLBACK_ZIP_US)
  const minimalAddress = {
    first_name: "—",
    last_name: "—",
    address_1: "—",
    city: "—",
    postal_code: postal,
    country_code: cc,
    province: "",
    phone: "",
    company: "",
  }
  try {
    const prevMeta = { ...((live.metadata ?? {}) as Record<string, unknown>) }
    await sdk.store.cart.update(
      cartId,
      {
        shipping_address: minimalAddress as any,
        billing_address: minimalAddress as any,
        metadata: prevMeta,
      },
      {},
      await getAuthHeaders()
    )
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
    const fulfillmentCacheTag = await getCacheTag("fulfillment")
    revalidateTag(fulfillmentCacheTag)
  } catch {
    // Non-fatal; caller may still get empty shipping options
  }
}

/**
 * Checkout UX: `pickup` hides shop-for-delivery and locks flow to store + pickup slot.
 */
export async function setCartCheckoutFulfillment(
  mode: "delivery" | "pickup"
): Promise<{ success: boolean; error?: string }> {
  try {
    const cartId = await getCartId()
    if (!cartId) return { success: false, error: "No cart found." }
    const live = await retrieveCartLive(cartId)
    const metadata = {
      ...((live?.metadata ?? {}) as Record<string, unknown>),
    }
    metadata.checkout_fulfillment = mode
    if (mode === "delivery") {
      for (const k of PICKUP_SLOT_META_KEYS) {
        delete metadata[k]
      }
    }
    await updateCart({ metadata } as HttpTypes.StoreUpdateCart)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Failed to update cart." }
  }
}

const IN_STORE_LIST_META_KEYS = [
  "in_store_list_store_id",
  "in_store_list_store_name",
  "in_store_list_store_address",
] as const

/**
 * Persists the store the customer chose for “Shop in Store (Create a list)” (browse / wishlist context).
 */
export async function setShopInStoreListStore(store: {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const cartId = await getCartId()
    if (!cartId) return { success: false, error: "No cart found." }
    const live = await retrieveCartLive(cartId)
    const metadata = {
      ...((live?.metadata ?? {}) as Record<string, unknown>),
    }
    metadata.in_store_list_store_id = store.id
    metadata.in_store_list_store_name = store.name
    metadata.in_store_list_store_address = `${store.address}, ${store.city}, ${store.state} ${store.zip}`
    await updateCart({ metadata } as HttpTypes.StoreUpdateCart)
    return { success: true }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message ?? "Failed to save store for your list.",
    }
  }
}

export async function clearShopInStoreListStore(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const cartId = await getCartId()
    if (!cartId) return { success: false, error: "No cart found." }
    const live = await retrieveCartLive(cartId)
    const metadata = {
      ...((live?.metadata ?? {}) as Record<string, unknown>),
    }
    for (const k of IN_STORE_LIST_META_KEYS) {
      delete metadata[k]
    }
    await updateCart({ metadata } as HttpTypes.StoreUpdateCart)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Failed to clear store." }
  }
}

export async function setPickupTimeSlot(
  slot: PickupSlotInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const cartId = await getCartId()
    if (!cartId) return { success: false, error: "No cart found." }
    const live = await retrieveCartLive(cartId)
    const metadata = {
      ...((live?.metadata ?? {}) as Record<string, unknown>),
    }
    metadata.pickup_slot_id = slot.slotId
    metadata.pickup_slot_date_label = slot.dateLabel
    metadata.pickup_slot_start = slot.startTime
    metadata.pickup_slot_end = slot.endTime
    metadata.pickup_slot_date_iso = slot.dateIso
    await updateCart({ metadata } as HttpTypes.StoreUpdateCart)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Failed to save pickup time." }
  }
}

/**
 * Sets the cart's shipping address and optional selected delivery store (e.g. for "Shop for Delivery").
 * When `store` is null, `delivery_store_*` metadata is removed (merged from live cart).
 * Optionally saves delivery time slot, contact phone, and order instructions (for store associates).
 * Does not redirect; caller should navigate to checkout after success.
 */
export async function setDeliveryAddressAndStore(
  address: DeliveryAddressInput,
  store: DeliveryStoreInput | null,
  email?: string,
  options?: {
    deliverySlot?: DeliverySlotInput
    contactPhone?: string
    orderInstructions?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const cartId = await getCartId()
    if (!cartId) {
      return { success: false, error: "No cart found." }
    }
    const live = await retrieveCartLive(cartId)
    const phone = options?.contactPhone ?? address.phone ?? ""
    const shipping_address = {
      first_name: address.first_name || "—",
      last_name: address.last_name || "—",
      address_1: address.address_1 || "—",
      address_2: "",
      company: address.company || "",
      postal_code: address.postal_code,
      city: address.city || "—",
      country_code: address.country_code,
      province: address.province || "",
      phone,
    }
    const metadata: Record<string, unknown> = {
      ...((live?.metadata ?? {}) as Record<string, unknown>),
    }
    for (const k of DELIVERY_STORE_META_KEYS) {
      delete metadata[k]
    }
    if (store) {
      metadata.delivery_store_id = store.id
      metadata.delivery_store_name = store.name
      metadata.delivery_store_address = `${store.address}, ${store.city}, ${store.state} ${store.zip}`
    }
    if (options?.deliverySlot) {
      metadata.delivery_slot_id = options.deliverySlot.slotId
      metadata.delivery_slot_date_label = options.deliverySlot.dateLabel
      metadata.delivery_slot_start = options.deliverySlot.startTime
      metadata.delivery_slot_end = options.deliverySlot.endTime
      metadata.delivery_slot_date_iso = options.deliverySlot.dateIso
    }
    if (options?.orderInstructions != null && options.orderInstructions !== "") {
      metadata.order_instructions = options.orderInstructions
    }
    const data: Record<string, unknown> = {
      shipping_address,
      billing_address: shipping_address,
      email: email || undefined,
      metadata,
    }
    await updateCart(data as HttpTypes.StoreUpdateCart)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to set address and store." }
  }
}

/**
 * Header “shop for delivery” with saved address + fulfillment store: cart + delivery_zip cookie.
 */
export async function applyHeaderDeliverySavedAddressAndStore(
  address: DeliveryAddressInput,
  store: DeliveryStoreInput,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await setDeliveryAddressAndStore(address, store, email)
  if (!result.success) return result
  await setDeliveryZip(address.postal_code)
  return { success: true }
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    const live = await retrieveCartLive(id)
    if (live?.items?.length) {
      const subscribeRows = live.items
        .map((item) => {
          const sub = parseSubscribeSaveFromLineMetadata(
            item.metadata as Record<string, unknown> | undefined
          )
          if (!sub) return null
          return {
            line_id: item.id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            ship_every_days: sub.shipEveryDays,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row != null)
      if (subscribeRows.length > 0) {
        const prev = (live.metadata ?? {}) as Record<string, unknown>
        await updateCart({
          metadata: {
            ...prev,
            subscribe_save_active: "true",
            subscribe_save_checkout_payload: JSON.stringify(subscribeRows),
          },
        } as HttpTypes.StoreUpdateCart)
      }
    }
  } catch {
    // Checkout can still proceed; line-level metadata remains on items.
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    removeCartId()
    redirect(`/${countryCode}/order/${cartRes?.order.id}/confirmed`)
  }

  return cartRes.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
