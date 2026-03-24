import { Suspense, type SVGProps } from "react"
import Image from "next/image"

import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { getDeliveryZip } from "@lib/data/cookies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButtonWrapper from "@modules/layout/components/cart-button-wrapper"
import { CartOutlineIcon } from "@modules/layout/components/cart-outline-icon"
import NavCartIconLink from "@modules/layout/components/nav-cart-icon-link"
import CategoryMenuBar from "@modules/layout/components/category-menu-bar"
import HeaderPromoNav from "@modules/layout/components/header-promo-nav"
import { resolveHeaderPromoDestinations } from "@lib/util/header-promo-destinations"
import DeliveringTo from "@modules/layout/components/delivery-location"
import HeaderSearch from "@modules/layout/components/header-search"
import LanguageSwitcher from "@modules/layout/components/language-switcher"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation } from "@lib/i18n/translations"
import {
  getCustomerFullName,
  getLoyaltyPoints,
} from "@lib/util/customer-display"
import { HttpTypes } from "@medusajs/types"

type NavProps = {
  countryCode: string
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}

export default async function Nav({ countryCode, cart, customer }: NavProps) {
  const [categories, collectionsResult] = await Promise.all([
    listCategories({ limit: 100 }, countryCode).catch(() => []),
    listCollections({}, countryCode).catch(() => ({ collections: [] as HttpTypes.StoreCollection[] })),
  ])
  const headerPromo = resolveHeaderPromoDestinations(
    categories || [],
    collectionsResult.collections ?? []
  )
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)
  const deliveryZipCookie = await getDeliveryZip()
  const initialZip =
    cart?.shipping_address?.postal_code || deliveryZipCookie || null

  const accountDisplayName =
    getCustomerFullName(customer) ||
    customer?.email?.trim() ||
    ""
  const loyaltyPoints = customer ? getLoyaltyPoints(customer) : null

  return (
    <div className="sticky top-0 inset-x-0 z-50 group bg-white shadow-sm">
      <header className="relative mx-auto bg-white">
        {/* Tier 1 — utility / promo (GNC-style) */}
        <div className="bg-header-topbar text-grey-80 border-b border-grey-20">
          <div className="content-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-xs">
            <div className="flex items-center gap-2 xsmall:gap-3 min-w-0 flex-1 xsmall:flex-none">
              <a
                href="#site-main"
                className="underline underline-offset-2 hover:text-header-red shrink-0"
              >
                Enable Accessibility
              </a>
              <span
                className="text-grey-30 select-none hidden xsmall:inline"
                aria-hidden
              >
                |
              </span>
              <div className="min-w-0 hidden xsmall:block">
                <DeliveringTo
                  initialZip={initialZip}
                  countryCode={countryCode}
                  customer={customer}
                />
              </div>
            </div>

            <LocalizedClientLink
              href="/categories/hw_bogo50%25off"
              className="hidden tablet:inline font-medium text-header-promo underline underline-offset-2 hover:opacity-90 text-center order-last tablet:order-none w-full tablet:w-auto"
            >
              Buy 1, Get 1 50% Off!
            </LocalizedClientLink>
          </div>
        </div>

        {/* Tier 2 — logo, search, account */}
        <div className="bg-white border-b border-grey-20">
          <div className="content-container flex flex-col tablet:flex-row tablet:items-center gap-4 py-4">
            <LocalizedClientLink
              href="/"
              className="flex items-center shrink-0 hover:opacity-90 transition-opacity min-h-[44px]"
              data-testid="nav-store-link"
            >
              <div className="relative h-9 xsmall:h-11 tablet:h-12 w-[130px] xsmall:w-[180px] tablet:w-[220px]">
                <Image
                  src="/store-logo.png"
                  alt="GNC Store"
                  fill
                  className="object-contain object-left"
                  priority
                  sizes="(max-width: 512px) 130px, (max-width: 768px) 180px, 220px"
                  unoptimized={false}
                />
              </div>
            </LocalizedClientLink>

            <div className="xsmall:hidden pb-1 -mt-1">
              <DeliveringTo
                initialZip={initialZip}
                countryCode={countryCode}
                customer={customer}
                placement="inline"
              />
            </div>

            <div className="flex-1 min-w-0 flex justify-center tablet:px-4">
              <HeaderSearch
                variant="prominent"
                className="w-full max-w-full tablet:max-w-2xl"
              />
            </div>

            <div className="flex items-center justify-end gap-x-3 xsmall:gap-x-5 shrink-0 min-h-[44px]">
              <LanguageSwitcher />
              <LocalizedClientLink
                className="hover:text-header-red hidden small:inline text-sm font-medium text-grey-80 underline underline-offset-2"
                href="/wishlist"
                data-testid="nav-wishlist-link"
              >
                {t("nav.wishlist")}
              </LocalizedClientLink>
              {customer ? (
                <LocalizedClientLink
                  className="hover:text-header-red inline-flex items-center gap-2 text-sm font-bold text-grey-90 underline decoration-grey-90 underline-offset-4 max-w-[min(100%,14rem)] small:max-w-[16rem]"
                  href="/account"
                  data-testid="nav-account-link"
                  aria-label={
                    accountDisplayName
                      ? `${t("nav.myAccount")}: ${accountDisplayName}`
                      : t("nav.myAccount")
                  }
                >
                  <span className="flex flex-col items-end min-w-0 text-right">
                    <span className="truncate leading-tight font-bold">
                      {accountDisplayName}
                    </span>
                    {loyaltyPoints != null && loyaltyPoints > 0 ? (
                      <span
                        className="text-[11px] font-semibold text-header-red no-underline mt-0.5 leading-tight"
                        title={t("nav.loyaltyPointsLabel").replace(
                          "{{count}}",
                          String(loyaltyPoints)
                        )}
                      >
                        {t("nav.loyaltyPointsShort").replace(
                          "{{count}}",
                          String(loyaltyPoints)
                        )}
                      </span>
                    ) : null}
                  </span>
                  <NavSignInUserIcon className="h-6 w-6 shrink-0" aria-hidden />
                </LocalizedClientLink>
              ) : (
                <LocalizedClientLink
                  className="hover:text-header-red inline-flex items-center gap-2 text-sm font-bold text-grey-90 underline decoration-grey-90 underline-offset-4"
                  href="/account"
                  data-testid="nav-account-link"
                >
                  <span className="lowercase">{t("home.signIn")}</span>
                  <NavSignInUserIcon className="h-6 w-6 shrink-0" aria-hidden />
                </LocalizedClientLink>
              )}
              <Suspense
                fallback={
                  <NavCartIconLink className="text-grey-90 inline-flex items-center justify-center p-1 min-h-[44px] min-w-[44px]">
                    <span className="relative inline-flex items-center justify-center">
                      <CartOutlineIcon className="h-7 w-7 shrink-0" />
                    </span>
                  </NavCartIconLink>
                }
              >
                <CartButtonWrapper />
              </Suspense>
            </div>
          </div>
        </div>

        <HeaderPromoNav promo={headerPromo} />
        <CategoryMenuBar categories={categories || []} />
      </header>
    </div>
  )
}

/** Circular user outline — matches header “sign in” reference (text left, icon right). */
function NavSignInUserIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="12" cy="9" r="2.25" />
      <path d="M6.75 18.25c0-2.9 2.35-5.25 5.25-5.25s5.25 2.35 5.25 5.25" />
    </svg>
  )
}
