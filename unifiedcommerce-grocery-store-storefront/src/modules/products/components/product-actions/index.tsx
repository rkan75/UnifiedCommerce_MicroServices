"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import AddToWishlistButton from "@modules/common/components/add-to-wishlist-button"
import { dispatchCartUpdated } from "@modules/common/components/cart-provider"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import StockStatusBadge from "@modules/common/components/stock-status-badge"
import MobileActions from "./mobile-actions"
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

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const countryCode = useParams().countryCode as string

  // Default variant selection on load: prefer v_id from URL (preserves selection after navigation/re-render), else first in-stock or first variant
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

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
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

  // check if the selected variant is in stock
  const inStock = useMemo(
    () => (selectedVariant ? variantHasInventory(selectedVariant) : false),
    [selectedVariant]
  )

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart (no full page refresh — cart updates via context)
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)
    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        countryCode,
      })
      dispatchCartUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
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
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
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
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />
        <StockStatusBadge variant={selectedVariant as { manage_inventory?: boolean; allow_backorder?: boolean; inventory_quantity?: number }} variantStyle="default" />

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
            className="w-full h-10"
            isLoading={isAdding}
            data-testid="add-product-button"
          >
            {!selectedVariant && !options
              ? "Select variant"
              : !inStock || !isValidVariant
              ? "Out of stock"
              : "Add to cart"}
          </Button>
          <AddToWishlistButton
            productId={product.id!}
            variantId={selectedVariant?.id}
            showAsIcon={false}
          />
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
