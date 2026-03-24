import {
  ensureMinimalShippingAddressForShippingOptions,
  retrieveCart,
  setCartCheckoutFulfillment,
} from "@lib/data/cart"
import { listCartShippingOptionsAll } from "@lib/data/fulfillment"
import PickupStoreLocatorTemplate from "@modules/checkout/templates/pickup-store-locator"
import { resolvePickupOptionsForLocator } from "@modules/checkout/util/match-pickup-shipping-option"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Choose pickup store",
  description: "Find a store for order pickup.",
}

type PageProps = {
  params: Promise<{ countryCode: string }>
}

export default async function PickupStoreLocatorPage({ params }: PageProps) {
  const { countryCode } = await params
  const cart = await retrieveCart()

  if (!cart) {
    notFound()
  }

  const cc = countryCode.toLowerCase()
  await ensureMinimalShippingAddressForShippingOptions(cart.id, cc)
  await setCartCheckoutFulfillment("pickup")

  const allOptions = await listCartShippingOptionsAll(cart.id)
  const { pickupOptions } = resolvePickupOptionsForLocator(allOptions ?? [])

  return (
    <PickupStoreLocatorTemplate
      cart={cart}
      pickupMethods={pickupOptions}
      countryCode={countryCode}
    />
  )
}
