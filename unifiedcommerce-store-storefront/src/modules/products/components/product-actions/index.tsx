"use client"

import { PRIMARY_ADD_TO_CART_BUTTON_CLASS } from "@lib/ui/primary-add-to-cart-button"
import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button, clx } from "@medusajs/ui"
import AddToWishlistButton from "@modules/common/components/add-to-wishlist-button"
import {
  dispatchCartUpdated,
  useCart,
} from "@modules/common/components/cart-provider"
import SavingsBadge from "@modules/common/components/savings-badge"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import ProductPrice from "@modules/products/components/product-price"
import ProductRatingBlock from "@modules/products/components/product-rating-block"
import StockStatusBadge from "@modules/common/components/stock-status-badge"
import { getProductPrice } from "@lib/util/get-product-price"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import MobileActions from "./mobile-actions"
import {
  buildSubscribeSaveLineMetadata,
  DEFAULT_SHIP_EVERY_DAYS,
  isProductSubscribeEligible,
  isSubscribeSaveOptedOut,
  SHIP_EVERY_OPTIONS_DAYS,
} from "@lib/config/subscribe-save-metadata"
import { useSubscribeSaveOptOutKeys } from "@modules/common/components/subscribe-save-block-context"
import { useShopInStoreListLabels } from "@lib/hooks/use-shop-in-store-list-mode"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

function variantHasInventory(v: HttpTypes.StoreProductVariant): boolean {
  if (!v.manage_inventory) return true
  if (v.allow_backorder) return true
  return (v.inventory_quantity ?? 0) > 0
}

function metaString(
  product: HttpTypes.StoreProduct,
  key: string
): string | null {
  const m = product.metadata as Record<string, unknown> | null | undefined
  const v = m?.[key]
  return typeof v === "string" && v.trim() ? v.trim() : null
}

export default function ProductActions({
  product,
  region: _region,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [subscribeChecked, setSubscribeChecked] = useState(false)
  const [shipEveryDays, setShipEveryDays] = useState<string>(DEFAULT_SHIP_EVERY_DAYS)
  const countryCode = useParams().countryCode as string
  const { refetchCart } = useCart() ?? {}
  const subscribeOptOutKeys = useSubscribeSaveOptOutKeys()
  const listLabels = useShopInStoreListLabels()

  useEffect(() => {
    if (!product.variants?.length) return
    const vIdFromUrl = searchParams.get("v_id")
    if (vIdFromUrl) {
      const variantFromUrl = product.variants.find((v) => v.id === vIdFromUrl)
      if (variantFromUrl) {
        const variantOptions = optionsAsKeymap(variantFromUrl.options)
        setOptions(variantOptions ?? {})
        return
      }
    }
    if (product.variants.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
      return
    }
    const firstInStock = product.variants.find(variantHasInventory)
    const defaultVariant = firstInStock ?? product.variants[0]
    const variantOptions = optionsAsKeymap(defaultVariant.options)
    setOptions(variantOptions ?? {})
  }, [product.variants, searchParams])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  const inStock = useMemo(
    () => (selectedVariant ? variantHasInventory(selectedVariant) : false),
    [selectedVariant]
  )

  const actionsRef = useRef<HTMLDivElement>(null)
  const inView = useIntersection(actionsRef, "0px")

  const selectedPrice = useMemo(() => {
    const { variantPrice, cheapestPrice } = getProductPrice({
      product,
      variantId: selectedVariant?.id,
    })
    return selectedVariant ? variantPrice : cheapestPrice
  }, [product, selectedVariant])

  const promotionBanner = metaString(product, "promotion_banner")
  const promotionDetail = metaString(product, "promotion_detail")
  const financingLabel = metaString(product, "financing_label")
  const subscribeSubtitle =
    metaString(product, "subscribe_subtitle") ??
    "Save on repeat deliveries—cancel or skip anytime."
  const subscribePriceDisplay = metaString(product, "subscribe_price_display")
  const subscribeShow = isProductSubscribeEligible(product)
  const subscribeBlocked = Boolean(
    selectedVariant?.id &&
      isSubscribeSaveOptedOut(
        subscribeOptOutKeys,
        selectedVariant.id,
        shipEveryDays
      )
  )

  useEffect(() => {
    if (subscribeBlocked) setSubscribeChecked(false)
  }, [subscribeBlocked])

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)
    try {
      const lineItemMetadata =
        subscribeShow && !subscribeBlocked
          ? buildSubscribeSaveLineMetadata(subscribeChecked, shipEveryDays)
          : undefined

      await addToCart({
        variantId: selectedVariant.id,
        quantity: Math.max(1, Math.min(99, quantity)),
        countryCode,
        lineItemMetadata,
      })
      if (refetchCart) await refetchCart()
      dispatchCartUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
        if (refetchCart) await refetchCart()
        dispatchCartUpdated()
        return
      }
      throw e
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-5" ref={actionsRef}>
        <ProductRatingBlock product={product} />

        <ProductPrice
          product={product}
          variant={selectedVariant}
          layout="pdp"
          showSavingsBadge={false}
        />

        <StockStatusBadge
          variant={
            selectedVariant as {
              manage_inventory?: boolean
              allow_backorder?: boolean
              inventory_quantity?: number
            }
          }
          variantStyle="default"
        />

        <div className="flex flex-col gap-2">
          {selectedPrice ? (
            <SavingsBadge
              price={selectedPrice}
              product={
                product as { tags?: Array<{ value?: string } | string> }
              }
              variant="default"
            />
          ) : null}
          {promotionBanner ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-teal-800 px-3 py-2.5 text-sm font-semibold text-white">
              <span className="flex-1">{promotionBanner}</span>
              {metaString(product, "promotion_banner_link_label") &&
              metaString(product, "promotion_banner_link_href") ? (
                <a
                  href={metaString(product, "promotion_banner_link_href")!}
                  className="shrink-0 underline decoration-white/80 hover:decoration-white"
                >
                  {metaString(product, "promotion_banner_link_label")}
                </a>
              ) : null}
            </div>
          ) : null}
          {promotionDetail ? (
            <p className="text-sm font-medium text-teal-700">{promotionDetail}</p>
          ) : null}
          {financingLabel ? (
            <p className="text-sm text-ui-fg-subtle">{financingLabel}</p>
          ) : null}
        </div>

        {(product.variants?.length ?? 0) > 1 && (product.options || []).length ? (
          <div className="flex flex-col gap-y-4">
            {(product.options || []).map((option) => (
              <div key={option.id}>
                <OptionSelect
                  option={option}
                  current={options[option.id]}
                  updateOption={setOptionValue}
                  title={option.title ?? ""}
                  data-testid="product-options"
                  disabled={!!disabled || isAdding}
                />
              </div>
            ))}
          </div>
        ) : null}

        {subscribeShow ? (
          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-3">
            {subscribeBlocked ? (
              <p className="text-sm text-ui-fg-muted">
                You cancelled Subscribe &amp; Save for this product on this
                delivery schedule. It is not available again for this variant and
                cadence.
              </p>
            ) : (
              <>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-ui-border-base text-emerald-600 focus:ring-emerald-600"
                    checked={subscribeChecked}
                    onChange={(e) => setSubscribeChecked(e.target.checked)}
                    disabled={!!disabled || isAdding}
                    data-testid="subscribe-save-checkbox"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      {subscribePriceDisplay ? (
                        <span className="text-lg font-bold text-ui-fg-base">
                          {subscribePriceDisplay}
                        </span>
                      ) : null}
                      <span className="font-semibold text-emerald-700">
                        Subscribe to save
                      </span>
                    </div>
                    <span className="text-sm text-ui-fg-subtle">
                      {subscribeSubtitle}
                    </span>
                  </div>
                </label>
                {subscribeChecked ? (
                  <div className="flex flex-col gap-1.5 pl-7">
                    <label
                      htmlFor="ship-every-days"
                      className="text-xs font-semibold uppercase text-ui-fg-subtle"
                    >
                      Ship every
                    </label>
                    <select
                      id="ship-every-days"
                      className="max-w-[220px] rounded-md border border-ui-border-base bg-white px-3 py-2 text-sm text-ui-fg-base"
                      value={shipEveryDays}
                      disabled={!!disabled || isAdding}
                      onChange={(e) => setShipEveryDays(e.target.value)}
                      data-testid="ship-every-select"
                    >
                      {SHIP_EVERY_OPTIONS_DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d} days
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="product-qty"
            className="text-xs font-semibold uppercase text-ui-fg-subtle"
          >
            Qty
          </label>
          <select
            id="product-qty"
            className="max-w-[120px] rounded-md border border-ui-border-base bg-white px-3 py-2 text-sm text-ui-fg-base"
            value={quantity}
            disabled={!!disabled || isAdding}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
            }
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleAddToCart}
            disabled={
              !inStock ||
              !selectedVariant ||
              !!disabled ||
              isAdding ||
              !isValidVariant
            }
            variant="primary"
            className={clx(
              "h-12 w-full font-semibold uppercase tracking-wide",
              PRIMARY_ADD_TO_CART_BUTTON_CLASS
            )}
            isLoading={isAdding}
            data-testid="add-product-button"
          >
            {!selectedVariant && !options
              ? "Select variant"
              : !inStock || !isValidVariant
                ? "Out of stock"
                : listLabels.addToCart}
          </Button>
          {selectedVariant?.id ? (
            <AddToWishlistButton
              productId={product.id!}
              variantId={selectedVariant.id}
              quantity={quantity}
              showAsIcon={false}
              className="w-full justify-center border border-ui-border-base"
            />
          ) : null}
        </div>

        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
