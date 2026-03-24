"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { Calendar, XMark } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { Fragment, useEffect, useMemo, useState } from "react"
import { RedDeliveryTruckIcon } from "@modules/common/icons/red-delivery-truck-icon"
import { useParams } from "next/navigation"
import {
  readHeaderFulfillmentPreference,
  writeHeaderFulfillmentPreference,
  type HeaderFulfillmentPreference,
} from "@lib/config/checkout-method-options"
import { useCart } from "@modules/common/components/cart-provider"
import CheckoutMethodModal from "@modules/cart/components/checkout-method-modal"
import DeliveryFlowModal from "@modules/cart/components/delivery-flow-modal"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import UpdateLocationPanel from "./update-location-panel"
import StoreDetailsModal from "./store-details-modal"
import type { StoreLocation } from "./store-finder-data"

const FULFILLMENT_LABEL: Record<HeaderFulfillmentPreference, string> = {
  delivery: "Shop For Delivery",
  in_store: "Shop in Store (Create a list)",
  pickup: "Shop for Pickup",
}

type DeliveringToProps = {
  initialZip: string | null
  countryCode: string
  customer: HttpTypes.StoreCustomer | null
  placement?: "bar" | "inline"
}

function storeFromCartMetadata(
  meta: Record<string, unknown> | undefined
): StoreLocation | null {
  const id = meta?.delivery_store_id
  if (id == null || id === "") return null
  const full = String(meta?.delivery_store_address ?? "")
  const parts = full.split(",").map((s) => s.trim())
  return {
    id: String(id),
    name: String(meta?.delivery_store_name ?? "Store"),
    address: parts[0] ?? full,
    city: parts[1] ?? "",
    state: parts[2] ?? "",
    zip: parts[3] ?? "",
    lat: 0,
    lng: 0,
  }
}

function IconStoreInfo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 38h36v4H6v-4zm2-18 6-10h28l6 10v18H8V20z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="12" r="5" fill="currentColor" />
      <path
        d="M24 9v4M24 15h.01"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Header fulfillment control: dropdown (reserve / store / pickup summary) and
 * “Change” opens the Unified Commerce “Where Else” modal.
 */
export default function DeliveringTo({
  initialZip,
  countryCode,
  customer,
  placement = "bar",
}: DeliveringToProps) {
  const params = useParams()
  const resolvedCountryCode = (params?.countryCode as string) || countryCode
  const cartCtx = useCart()
  const cart = cartCtx?.cart ?? null
  const refetchCart = cartCtx?.refetchCart

  /** Avoid hydration mismatch: SSR has no localStorage, so match that until after mount. */
  const [headerPrefFromStorage, setHeaderPrefFromStorage] = useState<
    HeaderFulfillmentPreference | undefined
  >(undefined)
  const [preferenceTick, setPreferenceTick] = useState(0)

  useEffect(() => {
    setHeaderPrefFromStorage(readHeaderFulfillmentPreference())
  }, [preferenceTick])
  const [locationPanelOpen, setLocationPanelOpen] = useState(false)
  const [checkoutMethodOpen, setCheckoutMethodOpen] = useState(false)
  const [deliveryFlowOpen, setDeliveryFlowOpen] = useState(false)
  const [storeDetailsOpen, setStoreDetailsOpen] = useState(false)

  const meta = cart?.metadata as Record<string, unknown> | undefined
  const effectiveFulfillment: HeaderFulfillmentPreference = useMemo(() => {
    if (meta?.checkout_fulfillment === "pickup") return "pickup"
    return headerPrefFromStorage ?? "delivery"
  }, [meta?.checkout_fulfillment, headerPrefFromStorage])

  const displayZip =
    cart?.shipping_address?.postal_code?.trim() || initialZip || "—"
  const deliveryStore = storeFromCartMetadata(meta)
  const deliveringLine = deliveryStore
    ? `Delivering from ${deliveryStore.name}${
        deliveryStore.address ? ` — ${deliveryStore.address}` : ""
      }`
    : `Delivering to ZIP ${displayZip}`

  const triggerTitle =
    effectiveFulfillment === "delivery"
      ? "Reserve Delivery Time"
      : effectiveFulfillment === "in_store"
        ? "Shop in Store"
        : "Shop for Pickup"

  const inStoreListName = meta?.in_store_list_store_name
    ? String(meta.in_store_list_store_name)
    : null

  const triggerSubtitle =
    effectiveFulfillment === "delivery" && deliveryStore
      ? `from ${deliveryStore.name}${deliveryStore.city ? ` — ${deliveryStore.city}` : ""}`
      : effectiveFulfillment === "delivery"
        ? `ZIP ${displayZip}`
        : effectiveFulfillment === "in_store"
          ? inStoreListName
            ? `List at ${inStoreListName}`
            : "Choose a store for your list"
          : "Find a store & time"

  const bumpPreference = () => setPreferenceTick((t) => t + 1)

  /** Match checkout modal option tiles (pickup PNG → header-red). */
  const PICKUP_ICON_RED_FILTER =
    "brightness(0) saturate(100%) invert(11%) sepia(100%) saturate(7438%) hue-rotate(330deg) brightness(98%) contrast(98%)"

  return (
    <>
      <Popover className="relative">
        {({ close: closePopover }) => (
          <>
            <div
              className={clx(
                "flex min-w-0 items-stretch rounded-md border border-grey-20 bg-white shadow-sm",
                placement === "bar" && "max-w-full",
                placement === "inline" && "w-full max-w-full"
              )}
            >
              <PopoverButton
                className={clx(
                  "flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-grey-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-header-red/40",
                  placement === "inline" && "min-h-[44px]"
                )}
                data-testid="header-fulfillment-trigger"
              >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  {effectiveFulfillment === "pickup" ? (
                    <Image
                      src="/pickup.png"
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                      style={{ filter: PICKUP_ICON_RED_FILTER }}
                    />
                  ) : (
                    <RedDeliveryTruckIcon className="h-8 w-8 shrink-0 text-header-red" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-grey-90">
                    {triggerTitle}
                  </span>
                  <span className="block truncate text-[11px] text-grey-80">
                    {triggerSubtitle}
                  </span>
                </span>
              </PopoverButton>
              <button
                type="button"
                className="shrink-0 border-l border-grey-20 px-2 text-grey-70 hover:bg-grey-5 hover:text-grey-90"
                aria-label="Close menu"
                onClick={(e) => {
                  e.preventDefault()
                  closePopover()
                }}
                data-testid="header-fulfillment-close"
              >
                <XMark className="h-4 w-4" />
              </button>
            </div>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-150"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel
                anchor={{ to: "bottom start", gap: 8 }}
                className="z-[60] w-[min(calc(100vw-1rem),520px)] rounded-lg border border-grey-20 bg-white shadow-xl [--anchor-max-height:min(70vh,560px)]"
                data-testid="header-fulfillment-dropdown"
              >
                <div className="flex items-center justify-between gap-3 border-b border-grey-20 px-4 py-3">
                  <p className="text-sm text-grey-90">
                    You&apos;ve selected{" "}
                    <span className="font-bold text-grey-90">
                      {FULFILLMENT_LABEL[effectiveFulfillment]}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-header-red px-3 py-1 text-xs font-semibold text-header-red transition-colors hover:bg-red-50"
                    onClick={() => {
                      closePopover()
                      setCheckoutMethodOpen(true)
                    }}
                    data-testid="header-fulfillment-change"
                  >
                    Change
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 p-4 small:grid-cols-2 small:gap-6">
                  <div className="flex flex-col gap-3 min-w-0">
                    {effectiveFulfillment === "delivery" && (
                      <>
                        {!customer ? (
                          <div className="rounded-md bg-grey-5 px-3 py-3 text-center text-xs text-grey-80">
                            <LocalizedClientLink
                              href="/account"
                              className="font-semibold text-header-red hover:underline"
                            >
                              Sign In or Register
                            </LocalizedClientLink>{" "}
                            to view your delivery address here
                          </div>
                        ) : (
                          <div className="rounded-md bg-grey-5 px-3 py-2 text-xs text-grey-80">
                            {cart?.shipping_address?.address_1 ? (
                              <p className="text-grey-90">
                                {[
                                  cart.shipping_address.address_1,
                                  cart.shipping_address.city,
                                  cart.shipping_address.province,
                                  cart.shipping_address.postal_code,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            ) : (
                              <p>Add your address during reservation.</p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-grey-80">{deliveringLine}</p>
                        <button
                          type="button"
                          className="self-start rounded-md border border-header-red px-3 py-1.5 text-xs font-semibold text-header-red hover:bg-red-50"
                          onClick={() => {
                            closePopover()
                            setLocationPanelOpen(true)
                          }}
                          data-testid="header-change-delivery-address"
                        >
                          Change Delivery address
                        </button>
                      </>
                    )}

                    {effectiveFulfillment === "in_store" && (
                      <div className="rounded-md bg-grey-5 px-3 py-3 text-xs text-grey-80">
                        {inStoreListName ? (
                          <>
                            <p className="font-medium text-grey-90">{inStoreListName}</p>
                            {meta?.in_store_list_store_address ? (
                              <p className="mt-1 text-grey-80">
                                {String(meta.in_store_list_store_address)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p>
                            Search and pick a store, then add items to your cart or
                            wishlist for your visit.
                          </p>
                        )}
                        <LocalizedClientLink
                          href="/shop-in-store-locator"
                          className="mt-2 block font-semibold text-header-red hover:underline"
                          onClick={() => closePopover()}
                        >
                          {inStoreListName ? "Change store" : "Find a store"}
                        </LocalizedClientLink>
                        <LocalizedClientLink
                          href="/checkout?step=address"
                          className="mt-2 block text-header-red/90 hover:underline"
                          onClick={() => closePopover()}
                        >
                          Continue to checkout
                        </LocalizedClientLink>
                      </div>
                    )}

                    {effectiveFulfillment === "pickup" && (
                      <div className="rounded-md bg-grey-5 px-3 py-3 text-xs text-grey-80">
                        Choose a pickup store and time to continue.
                        <LocalizedClientLink
                          href="/pickup-store-locator"
                          className="mt-2 block font-semibold text-header-red hover:underline"
                          onClick={() => closePopover()}
                        >
                          Find a store
                        </LocalizedClientLink>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-grey-20 bg-grey-5/50 px-4 py-6 text-center">
                    <IconStoreInfo className="h-14 w-16 text-header-red" />
                    {effectiveFulfillment === "delivery" ? (
                      deliveryStore ? (
                        <button
                          type="button"
                          className="text-sm font-bold text-header-red hover:underline"
                          onClick={() => setStoreDetailsOpen(true)}
                        >
                          Delivery address
                        </button>
                      ) : (
                        <span className="text-sm font-bold text-header-red">
                          Delivery address
                        </span>
                      )
                    ) : deliveryStore ? (
                      <button
                        type="button"
                        className="text-sm font-bold text-header-red hover:underline"
                        onClick={() => setStoreDetailsOpen(true)}
                      >
                        Store Info
                      </button>
                    ) : (
                      <span className="text-sm font-bold text-header-red">
                        Store Info
                      </span>
                    )}
                  </div>
                </div>

                {effectiveFulfillment === "delivery" && (
                  <div className="border-t border-grey-20 p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-header-red px-4 py-3 text-sm font-bold text-white hover:opacity-95"
                      onClick={() => {
                        closePopover()
                        setDeliveryFlowOpen(true)
                      }}
                      data-testid="header-reserve-delivery"
                    >
                      <Calendar className="h-5 w-5 shrink-0" aria-hidden />
                      Reserve Delivery Time
                    </button>
                  </div>
                )}
              </PopoverPanel>
            </Transition>
          </>
        )}
      </Popover>

      <UpdateLocationPanel
        isOpen={locationPanelOpen}
        onClose={() => setLocationPanelOpen(false)}
        countryCode={resolvedCountryCode}
        customer={customer}
        initialZip={initialZip}
      />

      <CheckoutMethodModal
        isOpen={checkoutMethodOpen}
        close={() => setCheckoutMethodOpen(false)}
        customer={customer}
        cart={
          !cart
            ? null
            : { ...cart, metadata: cart.metadata ?? undefined }
        }
        checkoutStep="address"
        headerContext
        onFulfillmentCommitted={() => {
          bumpPreference()
          void refetchCart?.()
        }}
      />

      <DeliveryFlowModal
        isOpen={deliveryFlowOpen}
        close={() => setDeliveryFlowOpen(false)}
        customer={customer}
        cart={
          !cart
            ? null
            : { ...cart, metadata: cart.metadata ?? undefined }
        }
        checkoutStep="payment"
        stayOnStorefrontAfterSuccess
        onSuccess={() => {
          writeHeaderFulfillmentPreference("delivery")
          bumpPreference()
          void refetchCart?.()
          setDeliveryFlowOpen(false)
        }}
      />

      <StoreDetailsModal
        store={storeDetailsOpen && deliveryStore ? deliveryStore : null}
        onClose={() => setStoreDetailsOpen(false)}
      />
    </>
  )
}
