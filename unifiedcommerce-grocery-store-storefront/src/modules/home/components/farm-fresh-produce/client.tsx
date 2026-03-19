"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button, Text, clx } from "@medusajs/ui"
import { addToCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SavingsBadge from "@modules/common/components/savings-badge"
import StockStatusBadge from "@modules/common/components/stock-status-badge"
import { getProductPrice } from "@lib/util/get-product-price"
import { ShoppingCart } from "@medusajs/icons"
import { getTranslation } from "@lib/i18n/translations"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

type FarmFreshProduceClientProps = {
  products: Array<{
    product: HttpTypes.StoreProduct
    category: string
  }>
  region: HttpTypes.StoreRegion
  countryCode: string
}

export default function FarmFreshProduceClient({
  products,
  region,
  countryCode,
}: FarmFreshProduceClientProps) {
  const router = useRouter()
  const [addingToCart, setAddingToCart] = useState<Record<string, boolean>>({})
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

  const handleAddToCart = async (product: HttpTypes.StoreProduct) => {
    if (!product.variants || product.variants.length === 0) return

    const variant = product.variants[0]
    if (!variant.id) return

    setAddingToCart((prev) => ({ ...prev, [product.id]: true }))

    try {
      await addToCart({
        variantId: variant.id,
        quantity: 1,
        countryCode,
      })
      // Refresh to update cart count in header
      router.refresh()
    } catch (error) {
      // Stale server action ID after dev restart — refresh to get new action IDs
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
        router.refresh()
      } else {
        console.error("Failed to add to cart:", error)
      }
    } finally {
      setAddingToCart((prev) => ({ ...prev, [product.id]: false }))
    }
  }

  return (
    <section className="bg-white py-12 border-b border-ui-border-base">
      <div className="content-container">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-ui-fg-base mb-2">
            {t("home.farmFreshProduce")}
          </h2>
          <p className="text-ui-fg-subtle text-base">
            {t("home.farmFreshDescription")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(({ product, category }) => {
            const { cheapestPrice } = getProductPrice({ product })
            const variant = product.variants?.[0]
            const isAdding = addingToCart[product.id] || false
            const canAddToCart =
              variant?.id &&
              (!variant.manage_inventory ||
                variant.allow_backorder ||
                (variant.inventory_quantity || 0) > 0)

            return (
              <div
                key={product.id}
                className="group flex flex-col bg-white border border-ui-border-base rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <LocalizedClientLink
                  href={`/products/${product.handle}`}
                  className="flex-1 flex flex-col"
                >
                  <div className="relative aspect-square bg-ui-bg-subtle">
                    {(cheapestPrice?.price_type === "sale" || (product as { tags?: unknown[] })?.tags?.length || product.variants?.[0]) ? (
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        {(cheapestPrice?.price_type === "sale" || (product as { tags?: unknown[] })?.tags?.length) ? (
                          <SavingsBadge
                            price={cheapestPrice}
                            product={product as { tags?: Array<{ value?: string } | string> }}
                            variant="compact"
                          />
                        ) : null}
                        <StockStatusBadge
                          variant={product.variants?.[0] as { manage_inventory?: boolean; allow_backorder?: boolean; inventory_quantity?: number }}
                          variantStyle="compact"
                        />
                      </div>
                    ) : null}
                    <Thumbnail
                      thumbnail={product.thumbnail}
                      images={product.images}
                      size="square"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="text-xs font-semibold text-green-600 mb-1 uppercase tracking-wide">
                      {category}
                    </div>
                    <h3 className="text-base font-semibold text-ui-fg-base mb-2 line-clamp-2 group-hover:text-ui-fg-base">
                      {product.title}
                    </h3>
                    {cheapestPrice && (
                      <div className="mt-auto pt-2 flex items-center gap-2">
                        {cheapestPrice.price_type === "sale" && (
                          <Text className="line-through text-ui-fg-muted text-sm">
                            {cheapestPrice.original_price}
                          </Text>
                        )}
                        <Text
                          className={clx("text-ui-fg-muted font-semibold", {
                            "text-ui-fg-interactive": cheapestPrice.price_type === "sale",
                          })}
                        >
                          {cheapestPrice.calculated_price}
                        </Text>
                      </div>
                    )}
                  </div>
                </LocalizedClientLink>
                <div className="px-4 pb-4">
                  <Button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleAddToCart(product)
                    }}
                    disabled={!canAddToCart || isAdding}
                    className="w-full"
                    isLoading={isAdding}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {isAdding ? t("home.adding") : t("home.addToCart")}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
