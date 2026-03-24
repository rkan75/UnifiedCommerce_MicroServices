"use client"

import { useShopInStoreListLabels } from "@lib/hooks/use-shop-in-store-list-mode"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { ReactNode } from "react"

/** Header cart icon link: aria label reflects shopping list vs cart mode. */
export default function NavCartIconLink({
  children,
  className,
  totalItems = 0,
}: {
  children: ReactNode
  className?: string
  totalItems?: number
}) {
  const { cartTitle } = useShopInStoreListLabels()
  const label =
    totalItems > 0
      ? `${cartTitle}, ${totalItems} item${totalItems === 1 ? "" : "s"}`
      : `${cartTitle} (empty)`

  return (
    <LocalizedClientLink
      className={className}
      href="/cart"
      data-testid="nav-cart-link"
      aria-label={label}
    >
      {children}
    </LocalizedClientLink>
  )
}
