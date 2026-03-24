import { retrieveCart } from "@lib/data/cart"
import Image from "next/image"
import { CartProvider } from "@modules/common/components/cart-provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CheckoutBackToCartLink from "@modules/checkout/components/checkout-back-to-cart-link"
import { Toaster } from "@medusajs/ui"

export const dynamic = "force-dynamic"

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cart = await retrieveCart().catch(() => null)

  return (
    <CartProvider initialCart={cart}>
      <Toaster />
      <div className="w-full bg-white relative small:min-h-screen">
      <div className="h-20 bg-white border-b ">
        <nav className="flex h-full items-center content-container justify-between">
          <CheckoutBackToCartLink />
          <LocalizedClientLink
            href="/"
            className="flex items-center shrink-0 hover:opacity-80 transition-opacity"
            data-testid="store-link"
          >
            <div className="relative h-14 md:h-16 w-[350px] md:w-[450px]">
              <Image
                src="/store-logo.png"
                alt="GNC"
                fill
                className="object-contain object-left"
                priority
                sizes="(max-width: 768px) 350px, 450px"
                unoptimized={false}
              />
            </div>
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
    </div>
    </CartProvider>
  )
}
