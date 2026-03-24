"use client"

import { useShopInStoreListLabels } from "@lib/hooks/use-shop-in-store-list-mode"
import ChevronDown from "@modules/common/icons/chevron-down"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function CheckoutBackToCartLink() {
  const { backToCartLong } = useShopInStoreListLabels()

  return (
    <LocalizedClientLink
      href="/cart"
      className="text-small-semi text-ui-fg-base flex items-center gap-x-2 uppercase flex-1 basis-0"
      data-testid="back-to-cart-link"
    >
      <ChevronDown className="rotate-90" size={16} />
      <span className="mt-px hidden small:block txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base">
        {backToCartLong}
      </span>
      <span className="mt-px block small:hidden txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base">
        Back
      </span>
    </LocalizedClientLink>
  )
}
