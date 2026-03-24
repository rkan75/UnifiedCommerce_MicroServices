"use client"

import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { HttpTypes } from "@medusajs/types"
import ImageGallery from "./index"

type ProductImageGalleryProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Resolves which images to show for the current variant (from URL v_id).
 * Uses variant.images when linked, else variant.thumbnail as primary, else all product images.
 */
function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string | null
): { id: string; url: string }[] {
  const productImages = product.images ?? []
  if (!selectedVariantId || !product.variants?.length) {
    return productImages.length ? productImages : []
  }

  const variant = product.variants.find((v) => v.id === selectedVariantId)
  if (!variant) {
    return productImages.length ? productImages : []
  }

  // Prefer variant-specific images when the API returns them (image–variant links)
  if (variant.images?.length) {
    const imageIdsMap = new Map(variant.images.map((i) => [i.id, true]))
    const filtered = productImages.filter((i) => imageIdsMap.has(i.id))
    if (filtered.length) return filtered
  }

  // Fallback: use variant thumbnail as the primary image (e.g. color swatch / variant image)
  if (variant.thumbnail) {
    const rest = productImages.filter((i) => i.url !== variant.thumbnail)
    return [{ id: `${variant.id}-thumb`, url: variant.thumbnail }, ...rest]
  }

  return productImages.length ? productImages : []
}

export default function ProductImageGallery({ product }: ProductImageGalleryProps) {
  const searchParams = useSearchParams()
  const selectedVariantId = searchParams.get("v_id")

  const images = useMemo(
    () => getImagesForVariant(product, selectedVariantId),
    [product, selectedVariantId]
  )

  // If no variant-specific images, show all product images; fallback to product thumbnail
  const displayImages =
    images.length > 0
      ? images
      : (product.images ?? []).length > 0
        ? product.images ?? []
        : product.thumbnail
          ? [{ id: "product-thumb", url: product.thumbnail }]
          : []

  return <ImageGallery images={displayImages} objectFit="contain" />
}
