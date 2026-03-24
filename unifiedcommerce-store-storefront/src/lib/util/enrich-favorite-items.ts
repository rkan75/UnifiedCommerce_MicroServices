import { getProductsByIds } from "@lib/data/products"
import type { HttpTypes } from "@medusajs/types"

/** Minimal shape for wishlist / favourites rows that need title, thumbnail, handle from the catalog. */
export type FavoriteDisplayLine = {
  id: string
  title: string
  thumbnail: string | null
  variant_id: string
  product_handle: string | null
  product_id?: string
  quantity?: number
}

function variantThumbnail(
  product: HttpTypes.StoreProduct,
  variantId: string
): string | null {
  const v = product.variants?.find((x) => x.id === variantId) as
    | { thumbnail?: string | null }
    | undefined
  const t = v?.thumbnail
  return typeof t === "string" && t.trim() ? t : null
}

function firstProductImageUrl(product: HttpTypes.StoreProduct): string | null {
  const imgs = product.images
  if (!Array.isArray(imgs) || !imgs.length) return null
  const first = imgs[0] as { url?: string | null }
  const u = first?.url
  return typeof u === "string" && u.trim() ? u : null
}

/**
 * Fills title, thumbnail, and product_handle from the store API when the wishlist
 * plugin returns rows without expanded product data (common case).
 */
export async function enrichFavoriteDisplayItems<T extends FavoriteDisplayLine>(
  countryCode: string,
  items: T[]
): Promise<T[]> {
  const productIds = [
    ...new Set(items.map((i) => i.product_id).filter(Boolean) as string[]),
  ]
  if (!productIds.length) return items

  const productsMap = await getProductsByIds(countryCode, productIds).catch(
    () => new Map<string, HttpTypes.StoreProduct>()
  )

  return items.map((item) => {
    const p = item.product_id ? productsMap.get(item.product_id) : undefined
    if (!p) return item

    const fromVariant = variantThumbnail(p, item.variant_id)
    const thumb =
      fromVariant ||
      (typeof p.thumbnail === "string" && p.thumbnail.trim()
        ? p.thumbnail
        : null) ||
      firstProductImageUrl(p) ||
      item.thumbnail ||
      null
    const title =
      (p.title && String(p.title).trim()) || item.title || ""
    const handle = p.handle ?? item.product_handle

    return {
      ...item,
      title,
      thumbnail: thumb,
      product_handle: handle,
    }
  })
}
