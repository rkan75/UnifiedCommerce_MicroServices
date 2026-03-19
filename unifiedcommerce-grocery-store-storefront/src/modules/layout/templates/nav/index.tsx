import { Suspense } from "react"
import Image from "next/image"

import { listCategories } from "@lib/data/categories"
import { getDeliveryZip } from "@lib/data/cookies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButtonWrapper from "@modules/layout/components/cart-button-wrapper"
import CategoryMenuBar from "@modules/layout/components/category-menu-bar"
import DeliveringTo from "@modules/layout/components/delivery-location"
import HeaderSearch from "@modules/layout/components/header-search"
import LanguageSwitcher from "@modules/layout/components/language-switcher"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation } from "@lib/i18n/translations"
import { HttpTypes } from "@medusajs/types"

type NavProps = {
  countryCode: string
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}

export default async function Nav({ countryCode, cart, customer }: NavProps) {
  const categories = await listCategories().catch(() => [])
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)
  const deliveryZipCookie = await getDeliveryZip()
  const initialZip =
    cart?.shipping_address?.postal_code || deliveryZipCookie || null

  return (
    <div className="sticky top-0 inset-x-0 z-50 group bg-white">
      <header className="relative mx-auto border-b border-ui-border-base bg-white">
        {/* Top row: Logo | Delivering to zip | Search | Account | Cart */}
        <nav
          className="content-container txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between gap-2 xsmall:gap-4 tablet:gap-4 w-full min-h-14 h-14 tablet:h-16 small:h-20 text-small-regular"
          aria-label="Main navigation"
        >
          <LocalizedClientLink
            href="/"
            className="flex items-center shrink-0 hover:opacity-80 transition-opacity min-h-[44px] min-w-[44px]"
            data-testid="nav-store-link"
          >
            <div className="relative h-8 xsmall:h-10 tablet:h-12 small:h-14 w-[140px] xsmall:w-[200px] tablet:w-[260px] small:w-[320px]">
              <Image
                src="/tcslogo.png"
                alt="TCS Unified Commerce Grocery Store"
                fill
                className="object-contain object-left"
                priority
                sizes="(max-width: 512px) 140px, (max-width: 768px) 200px, (max-width: 1024px) 260px, 320px"
                unoptimized={false}
              />
            </div>
          </LocalizedClientLink>

          <DeliveringTo initialZip={initialZip} countryCode={countryCode} customer={customer} />

          <div className="flex-1 min-w-0 flex justify-center px-1 xsmall:px-2 ml-2 xsmall:ml-4 tablet:ml-6 max-w-[180px] xsmall:max-w-none">
            <HeaderSearch className="w-full max-w-full" />
          </div>

          <div className="flex items-center gap-x-2 xsmall:gap-x-4 small:gap-x-6 h-full shrink-0 min-h-[44px]">
            <LanguageSwitcher />
            <LocalizedClientLink
              className="hover:text-ui-fg-base hidden small:inline text-sm font-medium"
              href="/wishlist"
              data-testid="nav-wishlist-link"
            >
              {t("nav.wishlist")}
            </LocalizedClientLink>
            <LocalizedClientLink
              className="hover:text-ui-fg-base hidden small:inline text-sm font-medium"
              href="/account"
              data-testid="nav-account-link"
            >
              {t("nav.account")}
            </LocalizedClientLink>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2 text-sm font-medium"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  {t("nav.cart")} (0)
                </LocalizedClientLink>
              }
            >
              <CartButtonWrapper />
            </Suspense>
          </div>
        </nav>

        {/* Category menu bar — Shop by department */}
        <CategoryMenuBar categories={categories || []} />
      </header>
    </div>
  )
}
