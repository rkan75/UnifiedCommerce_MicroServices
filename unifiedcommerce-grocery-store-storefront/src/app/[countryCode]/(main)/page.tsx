import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import FarmFreshProduce from "@modules/home/components/farm-fresh-produce"
import WeeklyAd from "@modules/home/components/weekly-ad"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { getWishlist } from "@lib/data/wishlist"
import { getWeeklyAd } from "@lib/data/contentful-weekly-ad"
import type { PastPurchaseItem } from "@modules/home/components/home-badges"
import { HttpTypes } from "@medusajs/types"

function getPastPurchaseItems(orders: HttpTypes.StoreOrder[] | null): PastPurchaseItem[] {
  if (!orders?.length) return []
  const seen = new Set<string>()
  const items: PastPurchaseItem[] = []
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const variant = (item as { variant?: { id?: string; product_id?: string } }).variant
      const variantId = variant?.id
      if (!variantId || seen.has(variantId)) continue
      seen.add(variantId)
      const product = (item as { product?: { handle?: string; id?: string } }).product
      const productId =
        (item as { product_id?: string }).product_id ??
        product?.id ??
        variant?.product_id ??
        ""
      items.push({
        id: item.id,
        title: item.title ?? "",
        thumbnail: item.thumbnail ?? null,
        variant_id: variantId,
        product_handle: product?.handle ?? null,
        quantity: item.quantity ?? 1,
        product_id: productId || undefined,
      })
      if (items.length >= 5) return items
    }
  }
  return items
}

export const metadata: Metadata = {
  title: "Home",
  description:
    "TCS Unified Commerce Omnichannel - Shop the freshest produce, premium groceries, and organic essentials.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  let region: Awaited<ReturnType<typeof getRegion>> = null
  let collections: HttpTypes.StoreCollection[] | null = null
  let categories: HttpTypes.StoreProductCategory[] | null = null
  let customer: Awaited<ReturnType<typeof retrieveCustomer>> = null
  let orders: HttpTypes.StoreOrder[] | null = null
  let wishlistData: Awaited<ReturnType<typeof getWishlist>> = null
  let weeklyAd: Awaited<ReturnType<typeof getWeeklyAd>> | null = null

  try {
    region = await getRegion(countryCode)
    const [collectionsResult, categoriesResult] = await Promise.all([
      listCollections({ fields: "id, handle, title" }),
      listCategories().catch(() => []),
    ])
    collections = collectionsResult.collections
    categories = Array.isArray(categoriesResult) ? categoriesResult : null

    const [customerRes, ordersRes, wishlistRes, weeklyAdData] = await Promise.all([
      retrieveCustomer(),
      listOrders(5, 0).catch(() => null),
      getWishlist().catch(() => null),
      getWeeklyAd(countryCode, "en"),
    ])
    customer = customerRes
    orders = ordersRes
    wishlistData = wishlistRes
    weeklyAd = weeklyAdData
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Home] Backend fetch failed:", err)
    }
  }

  const pastPurchaseItems = getPastPurchaseItems(orders ?? null)
  const initialWishlistItems: PastPurchaseItem[] =
    wishlistData?.wishlist?.items?.map((i) => ({
      id: i.id,
      title: i.product?.title ?? i.variant?.title ?? "",
      thumbnail: i.product?.thumbnail ?? null,
      variant_id: i.product_variant_id,
      product_handle: i.product?.handle ?? null,
      quantity: i.quantity ?? 1,
      product_id: i.product_id,
    })) ?? []

  if (!collections || !region) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-fg-muted text-sm">
          Store is temporarily unavailable. Make sure the Medusa backend is running (e.g. <code className="rounded bg-fg-subtle/10 px-1.5 py-0.5 text-xs">npm run dev</code> in the backend project).
        </p>
      </div>
    )
  }

  return (
    <>
      <Hero
        customer={customer}
        orders={orders}
        pastPurchaseItems={pastPurchaseItems}
        initialWishlistItems={initialWishlistItems}
        countryCode={countryCode}
        categories={categories}
      />
      <FarmFreshProduce countryCode={countryCode} />
      <WeeklyAd countryCode={countryCode} ad={weeklyAd ?? undefined} />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}



