import {
  ensureMinimalShippingAddressForShippingOptions,
  retrieveCart,
} from "@lib/data/cart"
import { listCartShippingOptionsAll } from "@lib/data/fulfillment"
import PickupTimeslotTemplate from "@modules/checkout/templates/pickup-timeslot"
import { resolvePickupOptionsForLocator } from "@modules/checkout/util/match-pickup-shipping-option"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Choose Store Pickup Time",
  description: "Reserve a pickup timeslot for your order.",
}

type PageProps = {
  params: Promise<{ countryCode: string }>
}

export default async function PickupTimeslotPage({ params }: PageProps) {
  const { countryCode } = await params
  const cart = await retrieveCart()

  if (!cart) {
    notFound()
  }

  await ensureMinimalShippingAddressForShippingOptions(
    cart.id,
    countryCode.toLowerCase()
  )

  const allOptions = await listCartShippingOptionsAll(cart.id)
  const { pickupOptions } = resolvePickupOptionsForLocator(allOptions ?? [])
  const currentMethodId = cart.shipping_methods?.at(-1)?.shipping_option_id
  const hasPickupShipping =
    !!currentMethodId &&
    pickupOptions.some((o) => o.id === currentMethodId)

  const meta = cart.metadata as Record<string, unknown> | undefined
  const fulfillmentPickup = meta?.checkout_fulfillment === "pickup"

  if (!hasPickupShipping || !fulfillmentPickup) {
    redirect(`/${countryCode}/pickup-store-locator`)
  }

  return <PickupTimeslotTemplate countryCode={countryCode} />
}
