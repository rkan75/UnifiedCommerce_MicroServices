import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getHeaderFulfillmentCookie } from "@lib/data/cookies"
import { cartUsesShoppingListUi } from "@lib/util/shop-in-store-list-mode"
import CartTemplate from "@modules/cart/templates"
import ShopInStoreReviewCheckout from "@modules/checkout/components/shop-in-store-review-checkout"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const [cart, headerPref] = await Promise.all([
    retrieveCart(),
    getHeaderFulfillmentCookie(),
  ])
  const list = cartUsesShoppingListUi(cart, headerPref)
  return { title: list ? "My Shopping List" : "Cart" }
}

export default async function CartPage() {
  const cart = await retrieveCart()
  const customer = await retrieveCustomer()
  const headerPref = await getHeaderFulfillmentCookie()
  const shoppingListMode = cartUsesShoppingListUi(cart, headerPref)

  if (shoppingListMode) {
    return (
      <div className="py-6 tablet:py-12">
        <div className="content-container" data-testid="cart-container">
          <ShopInStoreReviewCheckout cart={cart} customer={customer} />
        </div>
      </div>
    )
  }

  return (
    <CartTemplate cart={cart} customer={customer} />
  )
}
