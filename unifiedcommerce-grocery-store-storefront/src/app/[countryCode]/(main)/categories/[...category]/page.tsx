import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"
import GiftCardsTemplate from "@modules/gift-cards/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const GIFT_CARDS_HANDLE = "gift-cards"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    priceMin?: string
    priceMax?: string
  }>
}

export async function generateStaticParams() {
  try {
    const product_categories = await listCategories()

    if (!product_categories) {
      return []
    }

    const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
  )

  const categoryHandles = product_categories.map(
    (category: any) => category.handle
  )

  const staticParams = countryCodes
    ?.map((countryCode: string | undefined) =>
      categoryHandles.map((handle: any) => ({
        countryCode,
        category: [handle],
      }))
    )
    .flat()

    return staticParams ?? []
  } catch {
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)

    const title = productCategory.name + " | TCS UnifiedCommerce Store"

    const description = productCategory.description ?? `${title} category.`

    return {
      title: `${title} | TCS UnifiedCommerce Store`,
      description,
      alternates: {
        canonical: `${params.category.join("/")}`,
      },
    }
  } catch (error) {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page, priceMin, priceMax } = searchParams

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  if (productCategory.handle === GIFT_CARDS_HANDLE) {
    const { response } = await listProducts({
      countryCode: params.countryCode,
      queryParams: {
        is_giftcard: true,
        limit: 10,
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.thumbnail,+metadata,",
      },
    })
    return (
      <GiftCardsTemplate
        products={response.products}
        countryCode={params.countryCode}
      />
    )
  }

  return (
    <CategoryTemplate
      category={productCategory}
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      priceMin={priceMin}
      priceMax={priceMax}
    />
  )
}
