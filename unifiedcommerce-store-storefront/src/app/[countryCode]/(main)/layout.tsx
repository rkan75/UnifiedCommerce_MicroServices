import { Metadata } from "next"

import { listCartOptions, retrieveCart } from "@lib/data/cart"

// Opt into dynamic rendering so cookies/headers work in layout and child components
export const dynamic = "force-dynamic"

import { retrieveCustomer } from "@lib/data/customer"
import { getWishlist } from "@lib/data/wishlist"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import { Toaster } from "@medusajs/ui"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import PreFooterPromo from "@modules/layout/components/pre-footer-promo"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"
import { CartProvider } from "@modules/common/components/cart-provider"
import { SubscribeSaveBlockProvider } from "@modules/common/components/subscribe-save-block-context"
import { WishlistProvider } from "@modules/common/components/wishlist-provider"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: {
  children: React.ReactNode
  params?: Promise<{ countryCode?: string }>
}) {
  const params = await (props.params ?? Promise.resolve({ countryCode: "us" }))
  const countryCode = params.countryCode ?? "us"

  let customer = null
  let cart = null
  let wishlist = null
  let shippingOptions: StoreCartShippingOption[] = []

  try {
    customer = await retrieveCustomer()
    cart = await retrieveCart()
    wishlist = customer ? await getWishlist().catch(() => null) : null
    if (cart) {
      const result = await listCartOptions().catch(() => ({ shipping_options: [] as StoreCartShippingOption[] }))
      shippingOptions = result?.shipping_options ?? []
    }
  } catch (err) {
    // Backend unreachable (e.g. fetch failed) — render shell with empty state
    if (process.env.NODE_ENV === "development") {
      console.error("[Layout] Backend fetch failed:", err)
    }
  }

  const wishlistVariantIds =
    wishlist?.wishlist?.items?.map((i) => i.product_variant_id).filter(Boolean) ??
    []

  return (
    <>
      <Toaster />
      <CartProvider initialCart={cart}>
        <SubscribeSaveBlockProvider customer={customer}>
        <Nav countryCode={countryCode} cart={cart} customer={customer} />
        {customer && cart && (
          <CartMismatchBanner customer={customer} cart={cart} />
        )}

        {cart && (
          <FreeShippingPriceNudge
            variant="popup"
            cart={cart}
            shippingOptions={shippingOptions}
          />
        )}
        <WishlistProvider initialVariantIds={wishlistVariantIds}>
          <div id="site-main" className="flex flex-col flex-1">
            {props.children}
          </div>
        </WishlistProvider>
        <PreFooterPromo countryCode={countryCode} />
        <Footer />
        </SubscribeSaveBlockProvider>
      </CartProvider>
    </>
  )
}
