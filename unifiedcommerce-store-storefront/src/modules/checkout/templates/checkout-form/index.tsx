import { ensureMinimalShippingAddressForShippingOptions } from "@lib/data/cart"
import { listCartShippingOptionsAll } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import ShopForDeliverySection from "@modules/checkout/components/shop-for-delivery-section"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  const checkoutCountry =
    cart.shipping_address?.country_code?.toLowerCase() ??
    cart.region?.countries?.[0]?.iso_2?.toLowerCase() ??
    "us"
  await ensureMinimalShippingAddressForShippingOptions(cart.id, checkoutCountry)

  const shippingMethods = (await listCartShippingOptionsAll(cart.id)) ?? []
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!paymentMethods) {
    return null
  }

  return (
    <div className="w-full grid grid-cols-1 gap-y-8">
      <Addresses cart={cart} customer={customer} />

      <ShopForDeliverySection cart={cart} customer={customer} />

      <Shipping cart={cart} availableShippingMethods={shippingMethods} />

      <Payment cart={cart} availablePaymentMethods={paymentMethods} />

      <Review cart={cart} />
    </div>
  )
}
