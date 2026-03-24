"use client"

import { useCart } from "@modules/common/components/cart-provider"
import CartDropdown from "@modules/layout/components/cart-dropdown"

export default function CartButtonWrapper() {
  const { cart } = useCart() ?? { cart: null }
  return <CartDropdown cart={cart} />
}
