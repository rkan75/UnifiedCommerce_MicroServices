"use client"

import { useState } from "react"
import { BuildingStorefront, CheckCircleSolid, MapPin } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, Heading, Text } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import DeliveryFlowModal from "@modules/cart/components/delivery-flow-modal"
import { useRouter } from "next/navigation"

type CartWithMetadata = HttpTypes.StoreCart & {
  metadata?: Record<string, unknown>
  region?: HttpTypes.StoreRegion
}

type ShopForDeliverySectionProps = {
  cart: CartWithMetadata | null
  customer: HttpTypes.StoreCustomer | null
}

function formatDeliveryAddress(address: HttpTypes.StoreCartAddress | null): string {
  if (!address?.address_1) return ""
  const parts = [
    address.address_1,
    address.address_2,
    [address.city, address.province].filter(Boolean).join(", "),
    address.postal_code,
    address.country_code?.toUpperCase(),
  ].filter(Boolean)
  return parts.join(", ")
}

export default function ShopForDeliverySection({
  cart,
  customer,
}: ShopForDeliverySectionProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [changeTarget, setChangeTarget] = useState<"address" | "store" | "timeslot">("address")

  const metadata = cart?.metadata as Record<string, string> | undefined

  if (!cart) {
    return null
  }

  if (metadata?.checkout_fulfillment === "pickup") {
    return null
  }

  const hasShopForDelivery =
    metadata?.delivery_store_id && cart?.shipping_address?.address_1

  if (!hasShopForDelivery) {
    return null
  }

  const storeName = metadata.delivery_store_name ?? ""
  const storeAddress = metadata.delivery_store_address ?? ""
  const slotDateLabel = metadata.delivery_slot_date_label ?? ""
  const slotTime = [metadata.delivery_slot_start, metadata.delivery_slot_end]
    .filter(Boolean)
    .join(" – ")

  const openModal = (target: "address" | "store" | "timeslot") => {
    setChangeTarget(target)
    setModalOpen(true)
  }

  const initialStep =
    changeTarget === "address" ? 1 : changeTarget === "store" ? 2 : 3

  return (
    <>
      <div className="bg-white">
        <div className="flex flex-row items-center justify-between mb-6">
          <Heading
            level="h2"
            className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
          >
            Reserve a Shop for Delivery
            <CheckCircleSolid className="text-ui-fg-success" />
          </Heading>
        </div>

        <div className="flex flex-col gap-6">
          {/* Shop for Delivery from */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <BuildingStorefront className="w-5 h-5 shrink-0 mt-0.5 text-ui-fg-muted" />
              <div className="flex-1 min-w-0">
                <Text className="txt-small-medium text-ui-fg-muted mb-1">
                  Shop for Delivery from
                </Text>
                <Text className="txt-medium text-ui-fg-base">
                  {storeName}
                </Text>
                <Text className="txt-small text-ui-fg-subtle">
                  {storeAddress}
                </Text>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  className="mt-2 border-header-red text-header-red"
                  onClick={() => openModal("store")}
                  data-testid="change-store-button"
                >
                  Change Store
                </Button>
              </div>
            </div>
          </div>

          {/* Delivering to */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-ui-fg-muted" />
              <div className="flex-1 min-w-0">
                <Text className="txt-small-medium text-ui-fg-muted mb-1">
                  Delivering to
                </Text>
                <Text className="txt-medium text-ui-fg-base">
                  {formatDeliveryAddress(cart.shipping_address ?? null)}
                </Text>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  className="mt-2 border-header-red text-header-red"
                  onClick={() => openModal("address")}
                  data-testid="change-address-button"
                >
                  Change Address
                </Button>
              </div>
            </div>
          </div>

          {/* Delivery time slot */}
          {metadata.delivery_slot_start && (
            <div className="flex flex-col gap-2">
              <Text className="txt-small-medium text-ui-fg-muted mb-1">
                Choose a Shop for Delivery Time
              </Text>
              <Text className="txt-medium text-ui-fg-base">
                {slotDateLabel}
                {slotTime ? `, ${slotTime}` : ""}
              </Text>
              <Button
                type="button"
                variant="secondary"
                size="small"
                className="mt-1 w-fit border-header-red text-header-red"
                onClick={() => openModal("timeslot")}
                data-testid="change-timeslot-button"
              >
                Change timeslot
              </Button>
            </div>
          )}
        </div>

        <Divider className="mt-8" />
      </div>

      <DeliveryFlowModal
        isOpen={modalOpen}
        close={() => setModalOpen(false)}
        customer={customer}
        cart={cart}
        checkoutStep="payment"
        initialStep={initialStep}
        onSuccess={() => {
          setModalOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
