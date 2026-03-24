/** Shared home / wishlist item shape (no "use client" — safe for server + client imports). */
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
