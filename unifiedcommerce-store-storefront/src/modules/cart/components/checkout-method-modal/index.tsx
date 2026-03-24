"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Button, Text } from "@medusajs/ui"
import Modal from "@modules/common/components/modal"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import DeliveryFlowModal from "@modules/cart/components/delivery-flow-modal"
import {
  getCheckoutShopInStoreListEnabled,
  writeHeaderFulfillmentPreference,
} from "@lib/config/checkout-method-options"
import { useParams, useRouter } from "next/navigation"
import { clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { RedDeliveryTruckIcon } from "@modules/common/icons/red-delivery-truck-icon"

/** Recolors raster icons toward `header-red` (#D10022); works with typical PNG icons. */
const OPTION_IMAGE_RED_FILTER =
  "brightness(0) saturate(100%) invert(11%) sepia(100%) saturate(7438%) hue-rotate(330deg) brightness(98%) contrast(98%)"

type CheckoutMethod = "delivery" | "in_store" | "pickup"

type CheckoutMethodModalProps = {
  isOpen: boolean
  close: () => void
  customer: HttpTypes.StoreCustomer | null
  cart: (HttpTypes.StoreCart & { region?: HttpTypes.StoreRegion }) | null
  checkoutStep: string
  /** Header dropdown: keep user on storefront after delivery flow; persist fulfillment choice. */
  headerContext?: boolean
  onFulfillmentCommitted?: () => void
  /** In-store list “Order online”: only Shop for Delivery (opens delivery flow on Continue). */
  deliveryOnly?: boolean
}

const ALL_OPTIONS: { id: CheckoutMethod; label: string; imageSrc: string }[] = [
  { id: "delivery", label: "Shop for Delivery", imageSrc: "/truck.png" },
  { id: "in_store", label: "Shop in Store (Create a list)", imageSrc: "/list.png" },
  { id: "pickup", label: "Shop for Pickup", imageSrc: "/pickup.png" },
]

export default function CheckoutMethodModal({
  isOpen,
  close,
  customer,
  cart,
  checkoutStep,
  headerContext = false,
  onFulfillmentCommitted,
  deliveryOnly = false,
}: CheckoutMethodModalProps) {
  const [selected, setSelected] = useState<CheckoutMethod>("delivery")
  const [deliveryFlowOpen, setDeliveryFlowOpen] = useState(false)
  const { countryCode } = useParams()
  const router = useRouter()

  const shopInStoreListEnabled = getCheckoutShopInStoreListEnabled()
  const options = useMemo(() => {
    if (deliveryOnly) {
      return ALL_OPTIONS.filter((o) => o.id === "delivery")
    }
    return shopInStoreListEnabled
      ? ALL_OPTIONS
      : ALL_OPTIONS.filter((o) => o.id !== "in_store")
  }, [shopInStoreListEnabled, deliveryOnly])

  useEffect(() => {
    if (!isOpen) return
    if (deliveryOnly) {
      setSelected("delivery")
      return
    }
    if (!shopInStoreListEnabled && selected === "in_store") {
      setSelected("delivery")
    }
  }, [isOpen, shopInStoreListEnabled, selected, deliveryOnly])

  const handleContinue = () => {
    if (selected === "delivery") {
      setDeliveryFlowOpen(true)
      return
    }
    close()
    if (headerContext) {
      if (selected === "pickup") {
        writeHeaderFulfillmentPreference("pickup")
      } else if (selected === "in_store") {
        writeHeaderFulfillmentPreference("in_store")
      }
      onFulfillmentCommitted?.()
    }
    if (selected === "pickup") {
      router.push(`/${countryCode}/pickup-store-locator`)
      return
    }
    if (selected === "in_store") {
      router.push(`/${countryCode}/shop-in-store-locator`)
      return
    }
    router.push(`/${countryCode}/checkout?step=${checkoutStep}`)
  }

  return (
    <Modal isOpen={isOpen} close={close} size="medium" data-testid="checkout-method-modal">
      <Modal.Title centered>
        <Text as="span" className="block text-xl font-semibold text-header-red">
          Unified Commerce
        </Text>
        <Text as="span" className="mt-0.5 block text-base font-bold text-header-red">
          Where Else
        </Text>
        <Text
          as="span"
          className="mx-auto mt-1 block max-w-md text-small-regular text-header-red"
        >
          Same unbeatable deals and savings, whether you shop online or in-store.
          Convenience made easy!
        </Text>
      </Modal.Title>
      <Modal.Body>
        <div className="flex flex-col gap-6 py-4">
          <div
            className={clx(
              "grid grid-cols-1 gap-4",
              options.length >= 3
                ? "small:grid-cols-3"
                : options.length === 2
                  ? "small:grid-cols-2"
                  : "small:max-w-xs small:mx-auto w-full"
            )}
          >
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={clx(
                  "flex flex-col items-center justify-center p-4 rounded-xl transition-all min-h-[140px] w-full border border-transparent",
                  selected === opt.id
                    ? "bg-red-50 ring-2 ring-header-red/35 border-header-red/20"
                    : "hover:bg-ui-bg-subtle/50"
                )}
                data-testid={`checkout-option-${opt.id}`}
              >
                <span
                  className={clx(
                    "flex items-center justify-center w-20 h-20 rounded-full mb-3 flex-shrink-0 overflow-hidden",
                    "bg-red-50/80 ring-1 ring-header-red/15",
                    selected === opt.id && "bg-red-100 ring-header-red/40"
                  )}
                >
                  {opt.id === "delivery" ? (
                    <RedDeliveryTruckIcon className="h-12 w-12 shrink-0 text-header-red" />
                  ) : (
                    <Image
                      src={opt.imageSrc}
                      alt={opt.label}
                      width={48}
                      height={48}
                      className="h-12 w-12 object-contain"
                      style={{ filter: OPTION_IMAGE_RED_FILTER }}
                    />
                  )}
                </span>
                <Text className="text-small-regular font-medium text-center w-full text-header-red">
                  {opt.label}
                </Text>
                {selected === opt.id && (
                  <Text className="text-xs mt-1 text-center w-full font-medium text-header-red">
                    Selected
                  </Text>
                )}
              </button>
            ))}
          </div>

          {!customer && (
            <div className="border-t border-ui-border-base pt-6 flex flex-col items-center justify-center gap-4">
              <Text className="font-semibold text-center text-header-red">
                Already have an account?
              </Text>
              <Button
                asChild
                className="text-white font-semibold px-6 hover:opacity-90 bg-header-red"
                data-testid="checkout-modal-sign-in-button"
              >
                <LocalizedClientLink href="/account">Sign In</LocalizedClientLink>
              </Button>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="w-full flex justify-center items-center gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            data-testid="checkout-modal-continue-button"
            className="text-white hover:opacity-90 bg-header-red"
          >
            Continue
          </Button>
        </div>
      </Modal.Footer>
      <DeliveryFlowModal
        isOpen={deliveryFlowOpen}
        close={() => setDeliveryFlowOpen(false)}
        customer={customer}
        cart={cart}
        checkoutStep={checkoutStep}
        stayOnStorefrontAfterSuccess={headerContext}
        onSuccess={() => {
          if (headerContext) {
            writeHeaderFulfillmentPreference("delivery")
            onFulfillmentCommitted?.()
          }
          setDeliveryFlowOpen(false)
          close()
        }}
      />
    </Modal>
  )
}
