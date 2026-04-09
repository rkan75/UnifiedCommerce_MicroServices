"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Heart } from "@medusajs/icons"
import { Button, Text, toast, clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import Modal from "@modules/common/components/modal"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { addToCart } from "@lib/data/cart"
import { PRIMARY_ADD_TO_CART_BUTTON_CLASS } from "@lib/ui/primary-add-to-cart-button"
import { dispatchCartUpdated } from "@modules/common/components/cart-provider"
import {
  addToWishlistByVariant,
  getWishlist,
  removeFromWishlistByVariant,
  type WishlistItem,
} from "@lib/data/wishlist"
import { formatMinorCurrency } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"
import useToggleState from "@lib/hooks/use-toggle-state"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"
import HomeProductCarousel from "@modules/home/components/home-product-carousel"
import type { PastPurchaseItem } from "@modules/home/types/past-purchase"
import { useShopInStoreListActive } from "@lib/hooks/use-shop-in-store-list-mode"
import { enrichFavoriteDisplayItems } from "@lib/util/enrich-favorite-items"

const FAVORITES_STORAGE_KEY = "medusa_favorite_items"

export type { PastPurchaseItem }

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

export type FavoriteItem = PastPurchaseItem

type HomeBadgesProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
  pastPurchaseItems: PastPurchaseItem[]
  initialWishlistItems?: PastPurchaseItem[]
  countryCode: string
  /** Featured products for carousel below badges (e.g. latest 6) */
  carouselProducts?: HttpTypes.StoreProduct[] | null
}

export default function HomeBadges({
  customer,
  orders,
  pastPurchaseItems,
  initialWishlistItems = [],
  countryCode,
  carouselProducts = null,
}: HomeBadgesProps) {
  const router = useRouter()
  const isShopInStoreList = useShopInStoreListActive()
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
    if (!customer) {
      loadFavorites()
      return
    }
    // Logged-in: wishlist rows often lack product expansion — enrich like /wishlist page
    let cancelled = false
    ;(async () => {
      const enriched = await enrichFavoriteDisplayItems(
        countryCode,
        initialWishlistItems
      ).catch(() => initialWishlistItems)
      if (!cancelled) setFavoriteItems(enriched)
    })()
    return () => {
      cancelled = true
    }
  }, [customer, initialWishlistItems, countryCode, loadFavorites])

  /** Map API wishlist rows to the shape used by the favourites modal / past purchases */
  const mapWishlistToFavoriteItems = useCallback(
    (items: WishlistItem[] | undefined): FavoriteItem[] => {
      if (!items?.length) return []
      return items.map((i) => ({
        id: i.id,
        title: i.product?.title ?? i.variant?.title ?? "",
        thumbnail: i.product?.thumbnail ?? null,
        variant_id: i.product_variant_id,
        product_handle: i.product?.handle ?? null,
        quantity: i.quantity ?? 1,
        product_id: i.product_id,
      }))
    },
    []
  )

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

  const handleFavourite = async () => {
    if (!customer) {
      setSignInPromptType("favorites")
      return
    }
    // Do not use localStorage for logged-in users — it overwrote the server wishlist with [].
    try {
      const wishlistRes = await getWishlist()
      let mapped = mapWishlistToFavoriteItems(wishlistRes?.wishlist?.items)
      if (!mapped.length) mapped = initialWishlistItems
      const enriched = await enrichFavoriteDisplayItems(
        countryCode,
        mapped
      ).catch(() => mapped)
      setFavoriteItems(enriched)
    } catch {
      const enriched = await enrichFavoriteDisplayItems(
        countryCode,
        initialWishlistItems
      ).catch(() => initialWishlistItems)
      setFavoriteItems(enriched)
    }
    openFavorites()
  }

  const handleAddToCart = async (variantId: string) => {
    setAddingVariantId(variantId)
    try {
      await addToCart({ variantId, quantity: 1, countryCode })
      dispatchCartUpdated()
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

      {carouselProducts && carouselProducts.length > 0 && (
        <HomeProductCarousel
          products={carouselProducts.slice(0, 6)}
          title={t("home.featuredCarouselTitle")}
          labels={{
            addToCart: t(
              isShopInStoreList ? "home.addToList" : "home.addToCart"
            ),
            moreStock: t("home.featuredMoreStock"),
            inStock: t("home.featuredInStock"),
            outOfStock: t("home.featuredOutOfStock"),
            categoryFallback: t("home.featuredCategoryFallback"),
            adding: t(
              isShopInStoreList ? "home.addingToList" : "home.adding"
            ),
          }}
        />
      )}

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
                          {formatMinorCurrency(
                            order.total ?? 0,
                            order.currency_code ?? "usd"
                          )}
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
                            variant="primary"
                            className={clx("w-fit", PRIMARY_ADD_TO_CART_BUTTON_CLASS)}
                            onClick={() => handleAddToCart(item.variant_id)}
                            disabled={!!addingVariantId}
                            isLoading={addingVariantId === item.variant_id}
                          >
                            {t(
                              isShopInStoreList
                                ? "home.addToList"
                                : "home.addToCart"
                            )}
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
                            variant="primary"
                            className={clx("w-fit", PRIMARY_ADD_TO_CART_BUTTON_CLASS)}
                            onClick={() => handleAddToCart(item.variant_id)}
                            disabled={!!addingVariantId}
                            isLoading={addingVariantId === item.variant_id}
                          >
                            {t(
                              isShopInStoreList
                                ? "home.addToList"
                                : "home.addToCart"
                            )}
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
