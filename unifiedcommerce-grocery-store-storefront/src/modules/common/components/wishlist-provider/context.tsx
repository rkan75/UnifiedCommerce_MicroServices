"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type WishlistContextValue = {
  /** Set of product variant IDs currently in the wishlist */
  wishlistVariantIds: Set<string>
  addVariantId: (id: string) => void
  removeVariantId: (id: string) => void
  isInWishlist: (variantId: string) => boolean
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  return ctx
}

type WishlistProviderProps = {
  initialVariantIds: string[]
  children: React.ReactNode
}

export function WishlistProvider({
  initialVariantIds,
  children,
}: WishlistProviderProps) {
  const [variantIds, setVariantIds] = useState<Set<string>>(
    () => new Set(initialVariantIds)
  )

  useEffect(() => {
    setVariantIds(new Set(initialVariantIds))
  }, [initialVariantIds.join(",")])

  const addVariantId = useCallback((id: string) => {
    setVariantIds((prev) => new Set(prev).add(id))
  }, [])

  const removeVariantId = useCallback((id: string) => {
    setVariantIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const isInWishlist = useCallback(
    (variantId: string) => variantIds.has(variantId),
    [variantIds]
  )

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlistVariantIds: variantIds,
      addVariantId,
      removeVariantId,
      isInWishlist,
    }),
    [variantIds, addVariantId, removeVariantId, isInWishlist]
  )

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  )
}
