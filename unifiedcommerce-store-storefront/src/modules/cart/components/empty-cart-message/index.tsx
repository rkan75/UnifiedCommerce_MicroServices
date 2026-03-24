"use client"

import { useShopInStoreListActive } from "@lib/hooks/use-shop-in-store-list-mode"
import { Heading, Text } from "@medusajs/ui"

import InteractiveLink from "@modules/common/components/interactive-link"

const EmptyCartMessage = () => {
  const fromPreference = useShopInStoreListActive()
  const isList = fromPreference

  return (
    <div className="py-48 px-2 flex flex-col justify-center items-start" data-testid="empty-cart-message">
      <Heading
        level="h1"
        className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
      >
        {isList ? "Shopping list" : "Cart"}
      </Heading>
      <Text className="text-base-regular mt-4 mb-6 max-w-[32rem]">
        {isList
          ? "Your shopping list is empty. Browse the store to add items for your in-store visit."
          : "You don&apos;t have anything in your cart. Let&apos;s change that, use the link below to start browsing our products."}
      </Text>
      <div>
        <InteractiveLink href="/store">Explore products</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
