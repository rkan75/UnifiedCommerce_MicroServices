import { retrieveCustomer } from "@lib/data/customer"
import { getProductsByIds } from "@lib/data/products"
import { getWishlist, type WishlistItem } from "@lib/data/wishlist"
import { Button, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import WishlistPageTemplate from "@modules/wishlist/templates/wishlist-page"

type Props = {
  params: Promise<{ countryCode: string }>
}

export default async function WishlistPage(props: Props) {
  const { countryCode } = await props.params
  const customer = await retrieveCustomer().catch(() => null)
  const wishlist = customer ? await getWishlist().catch(() => null) : null
  const rawItems = wishlist?.wishlist?.items ?? []

  // Enrich items with product details (title, handle, thumbnail) from store API
  const productIds = [...new Set(rawItems.map((i) => i.product_id).filter(Boolean))]
  const productsMap = productIds.length
    ? await getProductsByIds(countryCode, productIds).catch(() => new Map())
    : new Map()

  const items: WishlistItem[] = rawItems
    .filter((i) => i.product_variant_id)
    .map((item) => ({
      ...item,
      product: productsMap.get(item.product_id)
        ? {
            id: productsMap.get(item.product_id)!.id!,
            title: productsMap.get(item.product_id)!.title ?? "",
            handle: productsMap.get(item.product_id)!.handle,
            thumbnail: productsMap.get(item.product_id)!.thumbnail,
          }
        : item.product,
    }))

  if (!customer) {
    return (
      <div className="content-container py-12 text-center">
        <Text className="text-ui-fg-subtle text-large-regular block mb-4">
          Sign in to view and manage your wishlist.
        </Text>
        <LocalizedClientLink href="/account">
          <Button>Sign in</Button>
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <WishlistPageTemplate items={items} countryCode={countryCode} />
  )
}
