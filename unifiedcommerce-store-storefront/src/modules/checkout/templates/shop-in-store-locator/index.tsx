"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Heading, Text } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { setShopInStoreListStore } from "@lib/data/cart"
import CheckoutPickupStorePicker from "@modules/checkout/components/checkout-pickup-store-picker"
import type { StoreLocation } from "@modules/layout/components/delivery-location/store-finder-data"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { dispatchCartUpdated } from "@modules/common/components/cart-provider"

type ShopInStoreLocatorTemplateProps = {
  cart: HttpTypes.StoreCart
  countryCode: string
}

export default function ShopInStoreLocatorTemplate({
  cart,
  countryCode,
}: ShopInStoreLocatorTemplateProps) {
  const router = useRouter()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const meta = cart.metadata as Record<string, string> | undefined
  const initialSelectedId = meta?.in_store_list_store_id ?? null

  const [selectedStoreLocatorId, setSelectedStoreLocatorId] = useState<
    string | null
  >(initialSelectedId)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSelectStoreForList = async (store: StoreLocation) => {
    setError(null)
    setSelectedStoreLocatorId(store.id)
    setSubmitting(true)
    try {
      const r = await setShopInStoreListStore({
        id: store.id,
        name: store.name,
        address: store.address,
        city: store.city,
        state: store.state,
        zip: store.zip,
      })
      if (!r.success) {
        throw new Error(r.error ?? "Could not save store.")
      }
      dispatchCartUpdated()
      router.push(`/${countryCode}/store`)
      router.refresh()
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Could not save store. Try again."
      )
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/55 backdrop-blur-[2px] px-4 py-8 small:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-in-store-locator-title"
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ui-border-base bg-white shadow-2xl max-h-[min(920px,calc(100dvh-4rem))]">
        <div
          className="shrink-0 border-b border-ui-border-base px-5 pb-4 pt-6 small:px-8"
          style={{
            background:
              "linear-gradient(180deg, rgba(209, 0, 34, 0.06) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Text
                id="shop-in-store-locator-title"
                className="mb-0.5 text-xl font-semibold text-header-red"
              >
                Unified Commerce
              </Text>
              <Heading level="h1" className="text-lg font-bold text-ui-fg-base">
                Shop in store — Create a list
              </Heading>
              <Text className="mt-2 max-w-md text-small-regular text-ui-fg-muted">
                Search by city, state, or ZIP, then tap{" "}
                <span className="font-medium text-ui-fg-base">Find stores</span>.
                Choose the store where you&apos;ll shop; then browse the site and
                add items to your cart or wishlist for your visit.
              </Text>
            </div>
            <LocalizedClientLink
              href="/cart"
              className="shrink-0 rounded-md border border-ui-border-base px-3 py-1.5 text-sm font-medium text-header-red hover:bg-ui-bg-subtle"
            >
              Close
            </LocalizedClientLink>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 small:px-8">
          <CheckoutPickupStorePicker
            layout="locatorPage"
            mode="in_store_list"
            inputIdPrefix="shop-in-store-locator"
            pickupMethods={[]}
            selectedStoreLocatorId={selectedStoreLocatorId}
            onSelectStoreForPickup={() => {
              /* unused in in_store_list mode */
            }}
            onSelectStoreForInStoreList={handleSelectStoreForList}
          />

          {submitting && (
            <p className="mt-4 text-sm text-ui-fg-muted">
              Saving your store…
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-ui-border-base bg-ui-bg-subtle/40 px-5 py-4 small:px-8">
          <LocalizedClientLink
            href="/cart"
            className="text-sm text-ui-fg-muted hover:text-ui-fg-base"
          >
            ← Back to cart
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}
