"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Heart } from "@medusajs/icons"
import { Button, Text, toast } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import Modal from "@modules/common/components/modal"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { addToCart } from "@lib/data/cart"
import { addToWishlistByVariant, removeFromWishlistByVariant } from "@lib/data/wishlist"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"
import useToggleState from "@lib/hooks/use-toggle-state"
import { getTranslation } from "@lib/i18n/translations"

const FAVORITES_STORAGE_KEY = "medusa_favorite_items"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

export type PastPurchaseItem = {
  id: string
  title: string
  thumbnail: string | null
  variant_id: string
  product_handle: string | null
  quantity: number
  /** Set when item comes from wishlist API (needed for add/remove) */
  product_id?: string
}

export type FavoriteItem = PastPurchaseItem

type HomeBadgesProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
  pastPurchaseItems: PastPurchaseItem[]
  initialWishlistItems?: PastPurchaseItem[]
  countryCode: string
}

export default function HomeBadges({
  customer,
  orders,
  pastPurchaseItems,
  initialWishlistItems = [],
  countryCode,
}: HomeBadgesProps) {
  const router = useRouter()
  const [orderHistoryOpen, openOrderHistory, closeOrderHistory] =
    useToggleState(false)
  const [pastPurchasesOpen, openPastPurchases, closePastPurchases] =
    useToggleState(false)
  const [favoritesOpen, openFavorites, closeFavorites] = useToggleState(false)
  const [signInPromptType, setSignInPromptType] = useState<
    "order-history" | "past-purchases" | "favorites" | null
  >(null)
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null)
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([])
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

  const loadFavorites = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FavoriteItem[]
        setFavoriteItems(Array.isArray(parsed) ? parsed : [])
      } else {
        setFavoriteItems([])
      }
    } catch {
      setFavoriteItems([])
    }
  }, [])

  useEffect(() => {
    if (customer && initialWishlistItems.length >= 0) {
      setFavoriteItems(initialWishlistItems)
    } else {
      loadFavorites()
    }
  }, [customer, initialWishlistItems, loadFavorites])

  const addToFavorites = async (item: PastPurchaseItem) => {
    if (favoriteItems.some((i) => i.variant_id === item.variant_id)) return
    const prevItems = favoriteItems
    setFavoriteItems((prev) => [...prev, { ...item }])

    if (customer) {
      const result = await addToWishlistByVariant(
        item.variant_id,
        item.product_id,
        item.quantity ?? 1
      )
      if (result.success) {
        router.refresh()
      } else {
        toast.error(result.error || "Could not add to favourites")
        setFavoriteItems(prevItems)
      }
      return
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify([...prevItems, { ...item }])
      )
    }
  }

  const removeFromFavorites = async (variantId: string) => {
    if (customer) {
      const item = favoriteItems.find((i) => i.variant_id === variantId)
      const result = await removeFromWishlistByVariant(variantId, item?.product_id)
      if (result.success) {
        router.refresh()
      } else {
        toast.error(result.error || "Could not remove from favourites")
      }
      return
    }
    setFavoriteItems((prev) => {
      const next = prev.filter((i) => i.variant_id !== variantId)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }

  const isFavorite = (variantId: string) =>
    favoriteItems.some((i) => i.variant_id === variantId)

  const topOrders = orders?.slice(0, 5) ?? []
  const topPastItems = pastPurchaseItems.slice(0, 5)

  const handleViewOrder = () => {
    if (!customer) {
      setSignInPromptType("order-history")
      return
    }
    openOrderHistory()
  }

  const handleBuyItAgain = () => {
    if (!customer) {
      setSignInPromptType("past-purchases")
      return
    }
    openPastPurchases()
  }

  const handleFavourite = () => {
    if (!customer) {
      setSignInPromptType("favorites")
      return
    }
    loadFavorites()
    openFavorites()
  }

  const handleAddToCart = async (variantId: string) => {
    setAddingVariantId(variantId)
    try {
      await addToCart({ variantId, quantity: 1, countryCode })
      router.refresh()
    } catch (e) {
      // Stale server action ID after dev restart — refresh to get new action IDs
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
        router.refresh()
      } else {
        console.error(e)
      }
    } finally {
      setAddingVariantId(null)
    }
  }

  return (
    <>
      {/* Badges row - before category section */}
      <div className="bg-white border-b border-gray-100 py-8">
        <div className="content-container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Order History badge */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-xl border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors h-full">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/Mobile-Buy-it-again.webp"
                  alt="Order History"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h3 className="font-semibold text-ui-fg-base mb-1">{t("home.orderHistory")}</h3>
                <p className="text-sm text-ui-fg-subtle mb-3">
                  {t("home.orderHistoryDescription")}
                </p>
                <Button
                  variant="secondary"
                  size="small"
                  className="w-full sm:w-auto"
                  onClick={handleViewOrder}
                >
                  {t("home.viewOrder")}
                </Button>
              </div>
            </div>

            {/* Past Purchases badge */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-xl border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors h-full">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/Mobile-Past-Purchases.webp"
                  alt="Past Purchases"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h3 className="font-semibold text-ui-fg-base mb-1">
                  {t("home.pastPurchases")}
                </h3>
                <p className="text-sm text-ui-fg-subtle mb-3">
                  {t("home.pastPurchasesDescription")}
                </p>
                <Button
                  variant="secondary"
                  size="small"
                  className="w-full sm:w-auto"
                  onClick={handleBuyItAgain}
                >
                  {t("home.buyItAgain")}
                </Button>
              </div>
            </div>

            {/* Favorite Items badge */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-xl border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors h-full">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/Mobile-Favorites.webp"
                  alt="Favorite Items"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h3 className="font-semibold text-ui-fg-base mb-1">
                  {t("home.favoriteItems")}
                </h3>
                <p className="text-sm text-ui-fg-subtle mb-3">
                  {t("home.favoriteItemsDescription")}
                </p>
                <Button
                  variant="secondary"
                  size="small"
                  className="w-full sm:w-auto"
                  onClick={handleFavourite}
                >
                  {t("home.favourite")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-in prompt modal - when not logged in */}
      <Modal
        isOpen={!!signInPromptType}
        close={() => setSignInPromptType(null)}
        size="small"
      >
        <Modal.Title>
          <Text className="text-large-semi">{t("home.signInRequired")}</Text>
        </Modal.Title>
        <Modal.Body>
          <div className="py-4 text-center">
            <Text className="text-ui-fg-subtle">
              {signInPromptType === "order-history"
                ? t("home.signInToViewOrders")
                : signInPromptType === "favorites"
                  ? t("home.signInToViewFavorites")
                  : t("home.signInToViewPurchases")}
            </Text>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSignInPromptType(null)}>
            {t("home.cancel")}
          </Button>
          <Button asChild>
            <LocalizedClientLink href="/account">{t("home.signIn")}</LocalizedClientLink>
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Order History modal - top 5 orders with value */}
      <Modal isOpen={orderHistoryOpen} close={closeOrderHistory} size="medium">
        <Modal.Title>
          <Text className="text-large-semi">{t("home.orderHistory")}</Text>
        </Modal.Title>
        <Modal.Body>
          <div className="w-full max-w-full py-2 max-h-[60vh] overflow-y-auto">
            {topOrders.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {topOrders.map((order) => (
                  <li key={order.id}>
                    <LocalizedClientLink
                      href={`/account/orders/details/${order.id}`}
                      className="block"
                    >
                      <div className="flex justify-between items-center p-4 rounded-lg border border-ui-border-base hover:bg-ui-bg-subtle transition-colors">
                        <div>
                          <Text className="font-medium">
                            Order #{order.display_id}
                          </Text>
                          <Text className="text-small-regular text-ui-fg-subtle">
                            {new Date(order.created_at).toLocaleDateString()}
                          </Text>
                        </div>
                        <Text className="font-semibold text-ui-fg-base">
                          {convertToLocale({
                            amount: order.total ?? 0,
                            currency_code: order.currency_code ?? "usd",
                          })}
                        </Text>
                      </div>
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="text-ui-fg-subtle py-4">
                {t("home.noOrders")}
              </Text>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeOrderHistory}>
            {t("home.close")}
          </Button>
          <LocalizedClientLink href="/account/orders">
            <Button>{t("home.viewAllOrders")}</Button>
          </LocalizedClientLink>
        </Modal.Footer>
      </Modal>

      {/* Past Purchases modal - top 5 items with Add to Cart */}
      <Modal
        isOpen={pastPurchasesOpen}
        close={closePastPurchases}
        size="large"
      >
        <Modal.Title>
          <Text className="text-large-semi">{t("home.pastPurchases")}</Text>
        </Modal.Title>
        <Modal.Body>
          <div className="w-full max-w-full py-2 max-h-[60vh] overflow-y-auto">
            {topPastItems.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topPastItems.map((item) => (
                  <li key={item.id}>
                    <div className="flex gap-4 p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                      <div className="w-20 h-20 rounded-md overflow-hidden bg-ui-bg-base shrink-0">
                        <Thumbnail
                          thumbnail={item.thumbnail}
                          images={[]}
                          size="square"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <LocalizedClientLink
                            href={
                              item.product_handle
                                ? `/products/${item.product_handle}`
                                : "/store"
                            }
                            className="font-medium text-ui-fg-base hover:underline line-clamp-2"
                          >
                            {item.title}
                          </LocalizedClientLink>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            size="small"
                            className="w-fit"
                            onClick={() => handleAddToCart(item.variant_id)}
                            disabled={!!addingVariantId}
                            isLoading={addingVariantId === item.variant_id}
                          >
                            {t("home.addToCart")}
                          </Button>
                          {!isFavorite(item.variant_id) ? (
                            <Button
                              size="small"
                              variant="secondary"
                              className="w-fit"
                              onClick={() => addToFavorites(item)}
                            >
                              <Heart className="w-4 h-4 mr-1" />
                              {t("home.favourite")}
                            </Button>
                          ) : (
                            <span className="text-small-regular text-green-600 flex items-center">
                              <Heart className="w-4 h-4 mr-1 fill-current" />
                              {t("home.inFavourites")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="text-ui-fg-subtle py-4">
                {t("home.noPastPurchases")}
              </Text>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePastPurchases}>
            {t("home.close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Favorite Items modal - items marked favourite from past orders */}
      <Modal isOpen={favoritesOpen} close={closeFavorites} size="large">
        <Modal.Title>
          <Text className="text-large-semi">{t("home.favoriteItems")}</Text>
        </Modal.Title>
        <Modal.Body>
          <div className="w-full max-w-full py-2 max-h-[60vh] overflow-y-auto">
            {favoriteItems.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favoriteItems.map((item) => (
                  <li key={item.id}>
                    <div className="flex gap-4 p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                      <div className="w-20 h-20 rounded-md overflow-hidden bg-ui-bg-base shrink-0">
                        <Thumbnail
                          thumbnail={item.thumbnail}
                          images={[]}
                          size="square"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <LocalizedClientLink
                            href={
                              item.product_handle
                                ? `/products/${item.product_handle}`
                                : "/store"
                            }
                            className="font-medium text-ui-fg-base hover:underline line-clamp-2"
                          >
                            {item.title}
                          </LocalizedClientLink>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            size="small"
                            className="w-fit"
                            onClick={() => handleAddToCart(item.variant_id)}
                            disabled={!!addingVariantId}
                            isLoading={addingVariantId === item.variant_id}
                          >
                            {t("home.addToCart")}
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            className="w-fit"
                            onClick={() => removeFromFavorites(item.variant_id)}
                          >
                            {t("home.remove")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="text-ui-fg-subtle py-4">
                {t("home.noFavorites")}
              </Text>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeFavorites}>
            {t("home.close")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
