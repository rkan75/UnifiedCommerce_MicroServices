"use client"

import { HttpTypes } from "@medusajs/types"
import AddToWishlistButton from "@modules/common/components/add-to-wishlist-button"
import ProductImageGallery from "@modules/products/components/image-gallery/product-image-gallery"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"

type ProductImageColumnProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Left column: gallery + wishlist (top-right). Variant for wishlist follows URL v_id or first variant.
 */
export default function ProductImageColumn({ product }: ProductImageColumnProps) {
  const searchParams = useSearchParams()
  const variantId = useMemo(() => {
    const fromUrl = searchParams.get("v_id")
    if (fromUrl && product.variants?.some((v) => v.id === fromUrl)) {
      return fromUrl
    }
    return product.variants?.[0]?.id
  }, [searchParams, product.variants])

  return (
    <div className="relative w-full">
      {variantId ? (
        <div className="absolute right-2 top-2 z-10 tablet:right-3 tablet:top-3">
          <AddToWishlistButton
            productId={product.id!}
            variantId={variantId}
            showAsIcon
          />
        </div>
      ) : null}
      <ProductImageGallery product={product} />
    </div>
  )
}
