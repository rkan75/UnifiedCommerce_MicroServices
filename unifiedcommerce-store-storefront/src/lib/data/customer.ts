"use server"

import { sdk } from "@lib/config"
import storeApiError from "@lib/util/store-api-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { cache } from "react"
import { cartServiceFetch, throwIfCartServiceError } from "./cart-service-http"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"

/** One Medusa call per request when layout + home (or other RSC) both need the customer. */
async function retrieveCustomerUncached(): Promise<HttpTypes.StoreCustomer | null> {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) return null

  const headers = {
    ...authHeaders,
  }

  const next = {
    ...(await getCacheOptions("customers")),
  }

  return await sdk.client
    .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
      method: "GET",
      // Omit restrictive `fields` so first_name, last_name, metadata (e.g. loyalty_points), addresses, etc. are returned.
      headers,
      next,
      cache: "no-store",
    })
    .then(({ customer }) => customer)
    .catch(() => null)
}

export const retrieveCustomer = cache(retrieveCustomerUncached)

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(storeApiError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password: password,
    })

    await setAuthToken(token as string)

    const headers = {
      ...(await getAuthHeaders()),
    }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      headers
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    await transferCart()

    return createdCustomer
  } catch (error: any) {
    return error.toString()
  }
}

/** Return value: error string, or "OK" for success (client should redirect). */
export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const countryCode = (formData.get("country_code") as string)?.trim() || "us"

  try {
    const token = await sdk.auth.login("customer", "emailpass", { email, password })
    await setAuthToken(token as string)
    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)
  } catch (error: any) {
    return error.toString()
  }

  try {
    await transferCart()
  } catch (error: any) {
    return error.toString()
  }

  // Return success marker so client can redirect after the response (and cookie) are received.
  // Server redirect() can race with Set-Cookie; client redirect ensures cookie is sent first.
  return `OK:${countryCode}`
}

/**
 * Request a password reset for the given email.
 * Backend must have a subscriber for auth.password_reset to send the reset email.
 * Returns a message (success or error); does not reveal whether the email exists.
 */
export async function requestPasswordReset(_currentState: unknown, formData: FormData) {
  const email = (formData.get("email") as string)?.trim()
  if (!email) {
    return "Please enter your email address."
  }
  try {
    await sdk.auth.resetPassword("customer", "emailpass", { identifier: email })
    return "success"
  } catch (error: any) {
    return error?.message || "Something went wrong. Please try again."
  }
}

/**
 * Reset password using the token received by email.
 * Token and email typically come from the reset link query params.
 */
export async function resetPasswordWithToken(
  token: string,
  email: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedToken = (token || "").trim()
  const trimmedEmail = (email || "").trim()
  const trimmedPassword = (newPassword || "").trim()
  if (!trimmedToken) {
    return { success: false, error: "Invalid or missing reset link. Please request a new one." }
  }
  if (!trimmedEmail) {
    return { success: false, error: "Email is required." }
  }
  if (!trimmedPassword) {
    return { success: false, error: "Please enter a new password." }
  }
  try {
    // Backend derives entity_id (email) from the reset token; body must be { password } only.
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { password: trimmedPassword },
      trimmedToken
    )
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Could not reset password. The link may have expired. Please request a new one.",
    }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const customer = await retrieveCustomer()
  if (!customer?.id) {
    return
  }

  const res = await cartServiceFetch(
    `/store/carts/${encodeURIComponent(cartId)}/transfer`,
    {
      method: "POST",
      body: JSON.stringify({ customer_id: customer.id }),
    }
  )
  await throwIfCartServiceError(res, "Transfer cart")

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}
