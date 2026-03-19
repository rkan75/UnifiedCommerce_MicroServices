"use client"

import { ArrowRight, ShoppingBag } from "@medusajs/icons"
import { Button, Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import HomeBadges from "@modules/home/components/home-badges"
import type { PastPurchaseItem } from "@modules/home/components/home-badges"
import { HttpTypes } from "@medusajs/types"
import { getTranslation } from "@lib/i18n/translations"
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

const Hero = ({
  customer = null,
  orders = null,
  pastPurchaseItems = [],
  initialWishlistItems = [],
  countryCode = "us",
  categories = null,
}: HeroProps) => {
  const [locale, setLocale] = useState<"en" | "es">(() => {
    if (typeof window !== "undefined") {
      const cookieLocale = getCookie("_medusa_locale")
      if (cookieLocale) {
        const lang = cookieLocale.split("-")[0].toLowerCase()
        return lang === "es" ? "es" : "en"
      }
    }
    return "en"
  })

  useEffect(() => {
    const updateLocale = () => {
      if (typeof window === "undefined") return
      const cookieLocale = getCookie("_medusa_locale")
      let newLocale: "en" | "es" = "en"
      if (cookieLocale) {
        const lang = cookieLocale.split("-")[0].toLowerCase()
        newLocale = lang === "es" ? "es" : "en"
      }
      setLocale(newLocale)
    }

    updateLocale()

    // Listen for locale change events
    const handleLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ locale: "en" | "es" }>
      if (customEvent.detail?.locale) {
        setLocale(customEvent.detail.locale)
      } else {
        // Fallback to reading cookie
        updateLocale()
      }
    }

    // Also listen for visibility change (when page comes back into focus after refresh)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLocale()
      }
    }

    // Poll cookie periodically to catch changes (fallback)
    const interval = setInterval(() => {
      updateLocale()
    }, 300)

    if (typeof window !== "undefined") {
      window.addEventListener("localechange", handleLocaleChange)
      document.addEventListener("visibilitychange", handleVisibilityChange)
      return () => {
        clearInterval(interval)
        window.removeEventListener("localechange", handleLocaleChange)
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
    }
  }, [])

  const t = (key: string) => getTranslation(locale, key)

  return (
    <section className="relative w-full overflow-hidden">
      {/* Main Hero Section */}
      <div className="relative min-h-[85vh] md:min-h-[90vh] w-full bg-gradient-to-br from-green-50 via-emerald-50 to-lime-50">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Organic Shapes - 2026 Trend */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-green-200/40 to-emerald-300/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-lime-200/40 to-yellow-200/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          
          {/* Subtle Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #16a34a 1px, transparent 0)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        {/* Content Container */}
        <div className="content-container relative z-10 min-h-[85vh] md:min-h-[90vh] flex items-center py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
            {/* Left Column - Text Content */}
            <div className="space-y-8 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-green-200/50 rounded-full shadow-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-small-semi text-green-700">{t("home.freshAndOrganic")}</span>
                <span className="text-small-regular text-green-600">•</span>
                <span className="text-small-regular text-green-600">{t("home.freeDelivery")}</span>
              </div>

              {/* Main Heading */}
              <div className="space-y-4">
                <Heading
                  level="h1"
                  className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight"
                >
                  <span className="block text-gray-900">{t("home.freshGroceries")}</span>
                  <span className="block bg-gradient-to-r from-green-600 via-emerald-600 to-lime-600 bg-clip-text text-transparent">
                    {t("home.deliveredDaily")}
                  </span>
                </Heading>
                
                <Text className="text-lg md:text-xl text-gray-700 font-light max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  {t("home.heroDescription")}
                </Text>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <LocalizedClientLink href="/store">
                  <Button 
                    size="xlarge" 
                    className="group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 px-8 py-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    <span className="relative z-10 flex items-center gap-2 text-base font-semibold">
                      {t("home.shopNow")}
                      <ShoppingBag className="w-5 h-5" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  </Button>
                </LocalizedClientLink>
                
                <LocalizedClientLink href="/store">
                  <Button 
                    variant="secondary" 
                    size="xlarge"
                    className="group backdrop-blur-sm bg-white/90 border-2 border-green-200 hover:bg-white hover:border-green-300 px-8 py-6 rounded-2xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105"
                  >
                    <span className="text-base font-semibold text-gray-900">{t("home.browseCategories")}</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </LocalizedClientLink>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start pt-8 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-semibold">✓</span>
                  <span>{t("home.freeDeliveryOver50")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-semibold">✓</span>
                  <span>{t("home.freshGuarantee")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-semibold">✓</span>
                  <span>{t("home.sameDayDelivery")}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Visual Elements */}
            <div className="relative hidden lg:block">
              <div className="relative h-[600px]">
                {/* Floating Product Cards - Bento Grid Style */}
                <div className="absolute top-0 right-0 w-64 h-72 backdrop-blur-xl bg-white/90 rounded-3xl p-6 shadow-2xl border border-white/80 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                  <div className="h-full bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex flex-col items-center justify-center p-6">
                    <div className="text-6xl mb-4">🥬</div>
                    <div className="text-lg font-semibold text-gray-800">{t("home.freshVegetables")}</div>
                    <div className="text-sm text-gray-600 mt-2">{t("home.organicAndLocal")}</div>
                  </div>
                </div>

                <div className="absolute top-1/3 left-0 w-56 h-72 backdrop-blur-xl bg-white/90 rounded-3xl p-6 shadow-2xl border border-white/80 transform -rotate-2 hover:rotate-0 transition-transform duration-500 delay-100">
                  <div className="h-full bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl flex flex-col items-center justify-center p-6">
                    <div className="text-6xl mb-4">🍎</div>
                    <div className="text-lg font-semibold text-gray-800">{t("home.freshFruits")}</div>
                    <div className="text-sm text-gray-600 mt-2">{t("home.seasonalSelection")}</div>
                  </div>
                </div>

                <div className="absolute bottom-0 right-1/4 w-60 h-64 backdrop-blur-xl bg-white/90 rounded-3xl p-6 shadow-2xl border border-white/80 transform rotate-1 hover:rotate-0 transition-transform duration-500 delay-200">
                  <div className="h-full bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex flex-col items-center justify-center p-6">
                    <div className="text-6xl mb-4">🥛</div>
                    <div className="text-lg font-semibold text-gray-800">{t("home.dairyAndMore")}</div>
                    <div className="text-sm text-gray-600 mt-2">{t("home.premiumQuality")}</div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-dashed border-green-200/50 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-green-100/50 rounded-full blur-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order History & Past Purchases badges */}
      <HomeBadges
        customer={customer}
        orders={orders}
        pastPurchaseItems={pastPurchaseItems}
        initialWishlistItems={initialWishlistItems}
        countryCode={countryCode}
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
    </section>
  )
}

export default Hero
