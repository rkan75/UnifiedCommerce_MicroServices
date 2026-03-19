"use client"

import { useState } from "react"
import Image from "next/image"
import { Button, Text } from "@medusajs/ui"
import Modal from "@modules/common/components/modal"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import DeliveryFlowModal from "@modules/cart/components/delivery-flow-modal"
import { useParams, useRouter } from "next/navigation"
import { clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"

const BRAND_GREEN = "#006F46"

type CheckoutMethod = "delivery" | "in_store" | "pickup"

type CheckoutMethodModalProps = {
  isOpen: boolean
  close: () => void
  customer: HttpTypes.StoreCustomer | null
  cart: (HttpTypes.StoreCart & { region?: HttpTypes.StoreRegion }) | null
  checkoutStep: string
}

const OPTIONS: { id: CheckoutMethod; label: string; imageSrc: string }[] = [
  { id: "delivery", label: "Shop for Delivery", imageSrc: "/truck.png" },
  { id: "in_store", label: "Shop In Store, Create a List", imageSrc: "/list.png" },
  { id: "pickup", label: "Shop for Pickup", imageSrc: "/pickup.png" },
]

export default function CheckoutMethodModal({
  isOpen,
  close,
  customer,
  cart,
  checkoutStep,
}: CheckoutMethodModalProps) {
  const [selected, setSelected] = useState<CheckoutMethod>("delivery")
  const [deliveryFlowOpen, setDeliveryFlowOpen] = useState(false)
  const { countryCode } = useParams()
  const router = useRouter()

  const handleContinue = () => {
    if (selected === "delivery") {
      setDeliveryFlowOpen(true)
      return
    }
    close()
    router.push(`/${countryCode}/checkout?step=${checkoutStep}`)
  }

  return (
    <Modal isOpen={isOpen} close={close} size="medium" data-testid="checkout-method-modal">
      <Modal.Title>
        <div className="flex flex-col items-center justify-center text-center w-full">
          <Text className="text-xl font-semibold w-full" style={{ color: BRAND_GREEN }}>
            TCS Unified Commerce
          </Text>
          <Text className="text-base font-bold mt-0.5 w-full" style={{ color: BRAND_GREEN }}>
            Where Else
          </Text>
          <Text className="text-small-regular mt-1 max-w-md mx-auto" style={{ color: BRAND_GREEN }}>
            Same unbeatable deals and savings, whether you shop online or in-store. Convenience made easy!
          </Text>
        </div>
      </Modal.Title>
      <Modal.Body>
        <div className="flex flex-col gap-6 py-4">
          <div className="grid grid-cols-1 small:grid-cols-3 gap-4">
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={clx(
                  "flex flex-col items-center justify-center p-4 rounded-xl transition-all min-h-[140px] w-full",
                  selected === opt.id ? "bg-ui-bg-subtle" : "hover:bg-ui-bg-subtle/50"
                )}
                data-testid={`checkout-option-${opt.id}`}
              >
                <span
                  className={clx(
                    "flex items-center justify-center w-20 h-20 rounded-full mb-3 flex-shrink-0 overflow-hidden",
                    "bg-ui-bg-subtle",
                    selected === opt.id && "bg-green-50/50"
                  )}
                >
                  <Image
                    src={opt.imageSrc}
                    alt={opt.label}
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </span>
                <Text className="text-small-regular font-medium text-center w-full" style={{ color: BRAND_GREEN }}>
                  {opt.label}
                </Text>
                {selected === opt.id && (
                  <Text className="text-xs mt-1 text-center w-full" style={{ color: BRAND_GREEN }}>Selected</Text>
                )}
              </button>
            ))}
          </div>

          {!customer && (
            <div className="border-t border-ui-border-base pt-6 flex flex-col items-center justify-center gap-4">
              <Text className="font-semibold text-center" style={{ color: BRAND_GREEN }}>
                Already have an account?
              </Text>
              <Button
                asChild
                className="text-white font-semibold px-6 hover:opacity-90"
                style={{ backgroundColor: BRAND_GREEN }}
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
            style={{ backgroundColor: BRAND_GREEN }}
            className="text-white hover:opacity-90"
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
        onSuccess={() => {
          setDeliveryFlowOpen(false)
          close()
        }}
      />
    </Modal>
  )
}
