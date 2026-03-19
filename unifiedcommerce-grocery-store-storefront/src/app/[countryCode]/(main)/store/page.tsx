import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Store",
  description: "Explore all of our products.",
}

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    q?: string
    category_id?: string
    priceMin?: string
    priceMax?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page, q, category_id: categoryId, priceMin, priceMax } = searchParams

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      q={q}
      countryCode={params.countryCode}
      categoryId={categoryId}
      priceMin={priceMin}
      priceMax={priceMax}
    />
  )
}
