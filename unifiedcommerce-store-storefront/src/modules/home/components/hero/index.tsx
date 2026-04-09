"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import HomeBadges from "@modules/home/components/home-badges"
import type { PastPurchaseItem } from "@modules/home/types/past-purchase"
import { HttpTypes } from "@medusajs/types"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"
import { useEffect, useState } from "react"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

type HeroProps = {
  customer?: HttpTypes.StoreCustomer | null
  orders?: HttpTypes.StoreOrder[] | null
  pastPurchaseItems?: PastPurchaseItem[]
  initialWishlistItems?: PastPurchaseItem[]
  countryCode?: string
  /** Root-level product categories for Shop by Category (same as nav). */
  categories?: HttpTypes.StoreProductCategory[] | null
  /** Latest products for carousel under order history / past purchases / favorites */
  carouselProducts?: HttpTypes.StoreProduct[] | null
}

/** Shop by Category: only these five, in this order, with fixed label and emoji */
const SHOP_BY_CATEGORY_CONFIG: { label: string; icon: string; matchNames: string[]; matchHandles: string[] }[] = [
  { label: "Produce", icon: "🥬", matchNames: ["Produce"], matchHandles: ["produce"] },
  { label: "Dairy & Eggs", icon: "🥛", matchNames: ["Dairy & Eggs", "Dairy and Eggs"], matchHandles: ["dairy-and-eggs", "dairy-eggs", "dairy"] },
  { label: "Bakery", icon: "🍞", matchNames: ["Bakery"], matchHandles: ["bakery"] },
  { label: "Frozen", icon: "🧊", matchNames: ["Frozen"], matchHandles: ["frozen"] },
  { label: "Deli", icon: "🥪", matchNames: ["Deli"], matchHandles: ["deli"] },
]

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*&\s*/g, " and ")
}

function getShopByCategoryItems(
  categories: HttpTypes.StoreProductCategory[] | null | undefined
): { category: HttpTypes.StoreProductCategory; label: string; icon: string }[] {
  const root = (categories ?? []).filter(
    (c: HttpTypes.StoreProductCategory) => !c.parent_category && c.handle
  ) as HttpTypes.StoreProductCategory[]
  const result: { category: HttpTypes.StoreProductCategory; label: string; icon: string }[] = []
  for (const config of SHOP_BY_CATEGORY_CONFIG) {
    const cat = root.find((c) => {
      const nameNorm = normalizeForMatch(c.name ?? "")
      const handleNorm = (c.handle ?? "").toLowerCase()
      const nameMatch = config.matchNames.some((n) => normalizeForMatch(n) === nameNorm)
      const handleMatch = config.matchHandles.some((h) => handleNorm === h || handleNorm.replace(/-/g, "") === h.replace(/-/g, ""))
      return nameMatch || handleMatch
    })
    if (cat) result.push({ category: cat, label: config.label, icon: config.icon })
  }
  return result
}

export default function Hero({
  customer = null,
  orders = null,
  pastPurchaseItems = [],
  initialWishlistItems = [],
  countryCode = "us",
  categories = null,
  carouselProducts = null,
}: HeroProps) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return resolveTranslationLocale(getCookie("_medusa_locale"))
    }
    return "en"
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateLocale = () => {
      setLocale(resolveTranslationLocale(getCookie("_medusa_locale")))
    }

    updateLocale()

    const handleLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ locale: Locale }>
      if (customEvent.detail?.locale) {
        setLocale(customEvent.detail.locale)
      } else {
        updateLocale()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLocale()
      }
    }

    const interval = setInterval(updateLocale, 300)

    window.addEventListener("localechange", handleLocaleChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener("localechange", handleLocaleChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const t = (key: string) => getTranslation(locale, key)

  return (
    <div className="w-full">
      {/* Banners + Shop by Brand render in page.tsx (RSC) */}

      {/* Order History & Past Purchases badges */}
      <HomeBadges
        customer={customer}
        orders={orders}
        pastPurchaseItems={pastPurchaseItems}
        initialWishlistItems={initialWishlistItems}
        countryCode={countryCode}
        carouselProducts={carouselProducts}
      />

      {/* Quick Categories Bar - only Produce, Dairy & Eggs, Bakery, Frozen, Deli with correct links */}
      {getShopByCategoryItems(categories).length > 0 && (
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="content-container py-6">
          <h2 className="text-3xl font-bold text-ui-fg-base mb-6 text-center">
            {t("home.shopByCategory")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {getShopByCategoryItems(categories).map(({ category, label, icon }) => (
              <LocalizedClientLink
                key={category.id}
                href={`/categories/${category.handle}`}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-green-50 transition-all duration-200 cursor-pointer"
              >
                <div className="text-4xl group-hover:scale-110 transition-transform duration-200">
                  {icon}
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 text-center">
                  {label}
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
