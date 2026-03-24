import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getHeaderFulfillmentCookie } from "@lib/data/cookies"
import { cartShowsShopInStoreReview } from "@lib/util/shop-in-store-list-mode"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Checkout" }
}

export default async function Checkout(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()
  const headerPref = await getHeaderFulfillmentCookie()

  if (cartShowsShopInStoreReview(cart, headerPref)) {
    redirect(`/${countryCode}/cart`)
  }

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
