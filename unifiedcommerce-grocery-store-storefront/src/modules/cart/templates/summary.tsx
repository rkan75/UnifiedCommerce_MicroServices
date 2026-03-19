"use client"

import { useState } from "react"
import { Button, Heading } from "@medusajs/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import CheckoutMethodModal from "@modules/cart/components/checkout-method-modal"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
  customer?: HttpTypes.StoreCustomer | null
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart, customer = null }: SummaryProps) => {
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-[2rem] leading-[2.75rem]">
        Summary
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      <Button
        className="w-full h-10"
        data-testid="checkout-button"
        onClick={() => setCheckoutModalOpen(true)}
      >
        Go to checkout
      </Button>
      <CheckoutMethodModal
        isOpen={checkoutModalOpen}
        close={() => setCheckoutModalOpen(false)}
        customer={customer ?? null}
        cart={cart}
        checkoutStep={step}
      />
    </div>
  )
}

export default Summary
