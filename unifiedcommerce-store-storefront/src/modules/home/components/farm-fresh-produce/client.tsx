"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button, Text, clx } from "@medusajs/ui"
import { addToCart } from "@lib/data/cart"
import { dispatchCartUpdated } from "@modules/common/components/cart-provider"
import { HttpTypes } from "@medusajs/types"
import { shouldUseUnoptimizedProductImage } from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SavingsBadge from "@modules/common/components/savings-badge"
import StockStatusBadge from "@modules/common/components/stock-status-badge"
import { getProductPrice } from "@lib/util/get-product-price"
import { ShoppingCart } from "@medusajs/icons"
import { useShopInStoreListActive } from "@lib/hooks/use-shop-in-store-list-mode"
import { PRIMARY_ADD_TO_CART_BUTTON_CLASS } from "@lib/ui/primary-add-to-cart-button"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"

function productImageUrl(product: HttpTypes.StoreProduct): string | null {
  const thumb = product.thumbnail
  if (thumb) return thumb
  const img = product.images?.[0]?.url
  return img ?? null
}

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
  const isShopInStoreList = useShopInStoreListActive()
  const [addingToCart, setAddingToCart] = useState<Record<string, boolean>>({})
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return resolveTranslationLocale(getCookie("_medusa_locale"))
    }
    return "en"
  })

  useEffect(() => {
    const updateLocale = () => {
      if (typeof window === "undefined") return
      setLocale(resolveTranslationLocale(getCookie("_medusa_locale")))
    }

    updateLocale()

    // Listen for locale change events
    const handleLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ locale: Locale }>
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
      dispatchCartUpdated()
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
    <section
      className="border-b border-ui-border-base bg-white py-12"
      aria-labelledby="subscribe-save-heading"
    >
      <div className="content-container">
        <div className="mb-8 text-center">
          <h2
            id="subscribe-save-heading"
            className="mb-2 text-3xl font-bold text-ui-fg-base"
          >
            {t("home.farmFreshProduce")}
          </h2>
          <p className="mx-auto max-w-4xl text-pretty text-base text-ui-fg-subtle">
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

            const imgSrc = productImageUrl(product)

            return (
              <div
                key={product.id}
                className="group flex flex-col bg-white border border-ui-border-base rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <LocalizedClientLink
                  href={`/products/${product.handle}`}
                  className="flex-1 flex flex-col"
                >
                  <div className="relative overflow-hidden bg-white px-3 pb-2 pt-4">
                    {(cheapestPrice?.price_type === "sale" || (product as { tags?: unknown[] })?.tags?.length || product.variants?.[0]) ? (
                      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
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
                    <div className="relative aspect-square w-full">
                      {imgSrc ? (
                        <Image
                          src={imgSrc}
                          alt={product.title ?? "Product"}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-contain object-center p-4 transition-transform duration-300 group-hover:scale-[1.02]"
                          unoptimized={shouldUseUnoptimizedProductImage(imgSrc)}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-ui-fg-muted text-sm">
                          —
                        </div>
                      )}
                    </div>
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
                    variant="primary"
                    className={clx("w-full", PRIMARY_ADD_TO_CART_BUTTON_CLASS)}
                    isLoading={isAdding}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {isAdding
                      ? t(
                          isShopInStoreList
                            ? "home.addingToList"
                            : "home.adding"
                        )
                      : t(
                          isShopInStoreList
                            ? "home.addToList"
                            : "home.addToCart"
                        )}
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
