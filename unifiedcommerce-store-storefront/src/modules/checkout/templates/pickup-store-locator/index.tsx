"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Heading, Text } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import {
  setCartCheckoutFulfillment,
  setShippingMethod,
} from "@lib/data/cart"
import CheckoutPickupStorePicker from "@modules/checkout/components/checkout-pickup-store-picker"
import type { StoreLocation } from "@modules/layout/components/delivery-location/store-finder-data"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const HEADER_RED = "#D10022"

type PickupStoreLocatorTemplateProps = {
  cart: HttpTypes.StoreCart
  pickupMethods: HttpTypes.StoreCartShippingOption[]
  countryCode: string
}

export default function PickupStoreLocatorTemplate({
  cart,
  pickupMethods,
  countryCode,
}: PickupStoreLocatorTemplateProps) {
  const router = useRouter()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const [selectedStoreLocatorId, setSelectedStoreLocatorId] = useState<
    string | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSelectStoreForPickup = async (
    store: StoreLocation,
    option: HttpTypes.StoreCartShippingOption
  ) => {
    setError(null)
    setSelectedStoreLocatorId(store.id)
    setSubmitting(true)
    try {
      await setCartCheckoutFulfillment("pickup")
      await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: option.id,
      })
      router.push(`/${countryCode}/pickup-timeslot`)
      router.refresh()
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Could not set pickup store. Try again."
      )
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/55 backdrop-blur-[2px] px-4 py-8 small:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pickup-locator-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-ui-border-base overflow-hidden flex flex-col max-h-[min(920px,calc(100dvh-4rem))]">
        <div
          className="shrink-0 px-5 small:px-8 pt-6 pb-4 border-b border-ui-border-base"
          style={{
            background: `linear-gradient(180deg, ${HEADER_RED}08 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Text
                id="pickup-locator-title"
                className="text-xl font-semibold mb-0.5 text-header-red"
              >
                Unified Commerce
              </Text>
              <Heading
                level="h1"
                className="text-lg font-bold text-header-red"
              >
                Store locator — Shop for pickup
              </Heading>
              <Text className="text-ui-fg-muted text-small-regular mt-2 max-w-md">
                Search by city, state, or ZIP code, then tap{" "}
                <span className="font-medium text-header-red">Find stores</span>{" "}
                to see nearby locations from our directory. Select a store to
                continue to checkout.
              </Text>
            </div>
            <LocalizedClientLink
              href="/cart"
              className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-md border border-header-red/35 text-header-red hover:bg-red-50"
            >
              Close
            </LocalizedClientLink>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 small:px-8 py-6">
          <CheckoutPickupStorePicker
            layout="locatorPage"
            locatorAccent="red"
            inputIdPrefix="pickup-locator"
            pickupMethods={pickupMethods}
            selectedStoreLocatorId={selectedStoreLocatorId}
            onSelectStoreForPickup={handleSelectStoreForPickup}
          />

          {submitting && (
            <p className="mt-4 text-sm text-ui-fg-muted">Taking you to checkout…</p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 px-5 small:px-8 py-4 border-t border-ui-border-base bg-ui-bg-subtle/40">
          <LocalizedClientLink
            href="/cart"
            className="text-sm font-medium text-header-red hover:opacity-80"
          >
            ← Back to cart
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}
