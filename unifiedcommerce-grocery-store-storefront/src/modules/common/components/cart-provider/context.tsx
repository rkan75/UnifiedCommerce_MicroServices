"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  startTransition,
} from "react"
import { HttpTypes } from "@medusajs/types"

const CART_UPDATED_EVENT = "cart-updated"

export function dispatchCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT))
  }
}

type CartContextValue = {
  cart: HttpTypes.StoreCart | null
  refetchCart: () => Promise<HttpTypes.StoreCart | null>
}

const CartContext = createContext<CartContextValue | null>(null)
const CartActionsContext = createContext<{ refetchCart: () => Promise<HttpTypes.StoreCart | null> } | null>(null)

export function useCart() {
  const ctx = useContext(CartContext)
  return ctx
}

/**
 * Hook to get cart actions without subscribing to cart data updates.
 * Use this in components that only need to trigger cart refetch (e.g. product list).
 */
export function useCartActions() {
  const ctx = useContext(CartActionsContext)
  return ctx
}

type CartProviderProps = {
  initialCart: HttpTypes.StoreCart | null
  children: React.ReactNode
}

export function CartProvider({ initialCart, children }: CartProviderProps) {
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(initialCart)
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const refetchCart = useCallback(async (): Promise<HttpTypes.StoreCart | null> => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        // Use startTransition to mark cart update as non-urgent (prevents flicker)
        startTransition(() => {
          setCart(data)
        })
        return data
      }
    } catch {
      // Keep existing cart on error
    }
    return null
  }, [])

  useEffect(() => {
    setCart(initialCart)
  }, [initialCart?.id])

  useEffect(() => {
    const handler = () => {
      // Debounce rapid cart updates to prevent flicker
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current)
      }
      refetchTimeoutRef.current = setTimeout(() => {
        refetchCart()
      }, 100) // Small delay to batch rapid updates
    }
    window.addEventListener(CART_UPDATED_EVENT, handler)
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, handler)
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current)
      }
    }
  }, [refetchCart])

  const value = useMemo<CartContextValue>(
    () => ({ cart, refetchCart }),
    [cart, refetchCart]
  )

  const actionsValue = useMemo(
    () => ({ refetchCart }),
    [refetchCart]
  )

  return (
    <CartContext.Provider value={value}>
      <CartActionsContext.Provider value={actionsValue}>
        {children}
      </CartActionsContext.Provider>
    </CartContext.Provider>
  )
}
