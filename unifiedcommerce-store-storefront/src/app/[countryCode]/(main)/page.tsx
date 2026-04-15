import { Metadata } from "next"
import dynamic from "next/dynamic"
import Image from "next/image"

import FarmFreshProduce from "@modules/home/components/farm-fresh-produce"
import HomeBrands from "@modules/home/components/home-brands"
import HomeHeroBanners from "@modules/home/components/home-hero-banners"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { getWishlist } from "@lib/data/wishlist"
import { listProducts } from "@lib/data/products"
import { enrichFavoriteDisplayItems } from "@lib/util/enrich-favorite-items"
import { resolvePromoCategoryHref } from "@lib/util/header-promo-destinations"
import type { PastPurchaseItem } from "@modules/home/types/past-purchase"
import { HttpTypes } from "@medusajs/types"

const Hero = dynamic(() => import("@modules/home/components/hero"), {
  loading: () => (
    <div
      className="min-h-[50vh] w-full animate-pulse bg-gradient-to-br from-green-50 via-emerald-50 to-lime-50"
      aria-hidden
    />
  ),
})

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
    "GNC Store — Shop vitamins, supplements, sports nutrition, and wellness essentials.",
}

const ONLINE_ONLY_CATEGORY = {
  matchHandles: ["online-only", "online-only-deals", "online"],
  matchNameKeywords: ["online only"],
  fallbackHref: "/categories/online-only",
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
  let carouselProducts: HttpTypes.StoreProduct[] = []

  const [
    regionSettled,
    collectionsSettled,
    categoriesSettled,
    customerSettled,
    carouselSettled,
  ] = await Promise.allSettled([
    getRegion(countryCode),
    listCollections({ fields: "id, handle, title, metadata" }, countryCode),
    listCategories({ limit: 100 }, countryCode).catch(() => []),
    retrieveCustomer(),
    listProducts({ countryCode, queryParams: { limit: 6 } })
      .then((r) => r.response.products.slice(0, 6))
      .catch(() => [] as HttpTypes.StoreProduct[]),
  ])

  if (regionSettled.status === "fulfilled") {
    region = regionSettled.value
  } else if (process.env.NODE_ENV === "development") {
    console.error("[Home] getRegion failed:", regionSettled.reason)
  }

  if (collectionsSettled.status === "fulfilled") {
    collections = collectionsSettled.value.collections
  } else if (process.env.NODE_ENV === "development") {
    console.error("[Home] listCollections failed:", collectionsSettled.reason)
  }

  if (categoriesSettled.status === "fulfilled") {
    categories = Array.isArray(categoriesSettled.value)
      ? categoriesSettled.value
      : null
  }

  if (customerSettled.status === "fulfilled") {
    customer = customerSettled.value
  }

  if (carouselSettled.status === "fulfilled") {
    carouselProducts = carouselSettled.value
  }

  if (customer) {
    const [ordersRes, wishlistRes] = await Promise.all([
      listOrders(5, 0).catch(() => null),
      getWishlist().catch(() => null),
    ])
    orders = ordersRes
    wishlistData = wishlistRes
  }

  const pastPurchaseItems = getPastPurchaseItems(orders ?? null)
  const initialWishlistItemsRaw: PastPurchaseItem[] =
    wishlistData?.wishlist?.items?.map((i) => ({
      id: i.id,
      title: i.product?.title ?? i.variant?.title ?? "",
      thumbnail: i.product?.thumbnail ?? null,
      variant_id: i.product_variant_id,
      product_handle: i.product?.handle ?? null,
      quantity: i.quantity ?? 1,
      product_id: i.product_id,
    })) ?? []

  /** Skip extra product batch fetch when wishlist rows already include titles */
  const needsWishlistEnrich =
    initialWishlistItemsRaw.length > 0 &&
    initialWishlistItemsRaw.some((i) => !String(i.title ?? "").trim())
  const initialWishlistItems = needsWishlistEnrich
    ? await enrichFavoriteDisplayItems(countryCode, initialWishlistItemsRaw).catch(
        () => initialWishlistItemsRaw
      )
    : initialWishlistItemsRaw
  const onlineOnlyHref = resolvePromoCategoryHref(
    categories ?? [],
    ONLINE_ONLY_CATEGORY
  )

  if (!collections || !region) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-fg-muted text-sm">
          Store is temporarily unavailable. The home page needs a region from{" "}
          <code className="rounded bg-fg-subtle/10 px-1.5 py-0.5 text-xs">REGIONS_SERVICE_URL</code>{" "}
          (Java regions-service, default port 8084) or{" "}
          <code className="rounded bg-fg-subtle/10 px-1.5 py-0.5 text-xs">MEDUSA_BACKEND_URL</code>, and
          collections from{" "}
          <code className="rounded bg-fg-subtle/10 px-1.5 py-0.5 text-xs">COLLECTIONS_SERVICE_URL</code>.
          Check the server console for errors.
        </p>
      </div>
    )
  }

  return (
    <>
      <section className="relative w-full overflow-hidden">
        <HomeHeroBanners heroHref="/categories/hw_bogo50%25off" onlineOnlyHref={onlineOnlyHref} />
        <HomeBrands collections={collections} />
        {/* Same horizontal width as Shop by Brand (`content-container`) */}
        <div className="w-full bg-white">
          <div className="content-container flex flex-col gap-3 small:gap-4">
            <Image
              src="/marchsale1.avif"
              alt="March sale promotion"
              width={1920}
              height={440}
              sizes="(max-width: 1440px) calc(100vw - 2rem), 1280px"
              className="h-auto w-full max-w-full rounded-lg"
              unoptimized
            />
            <Image
              src="/marchlws.avif"
              alt="Live Well Sale — March promotion"
              width={1920}
              height={320}
              sizes="(max-width: 1440px) calc(100vw - 2rem), 1280px"
              className="h-auto w-full max-w-full rounded-lg"
              unoptimized
            />
          </div>
        </div>
        <Hero
          customer={customer}
          orders={orders}
          pastPurchaseItems={pastPurchaseItems}
          initialWishlistItems={initialWishlistItems}
          countryCode={countryCode}
          categories={categories}
          carouselProducts={carouselProducts}
        />
      </section>
      <FarmFreshProduce
        countryCode={countryCode}
        region={region}
        categories={categories ?? undefined}
      />
    </>
  )
}



