"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { HttpTypes } from "@medusajs/types"
import ProductFacets from "./product-facets"
import { SortOptions } from "./sort-products"

function getPriceRangeValue(priceMin: string | null, priceMax: string | null): string {
  const min = priceMin != null && priceMin !== "" ? parseFloat(priceMin) : undefined
  const max = priceMax != null && priceMax !== "" ? parseFloat(priceMax) : undefined
  if (min === undefined && max === undefined) return ""
  if (min === 0 && max === 5) return "0-5"
  if (min === 5 && max === 10) return "5-10"
  if (min === 10 && max === 25) return "10-25"
  if (min === 25 && max === undefined) return "25-"
  return ""
}

type RefinementListProps = {
  sortBy: SortOptions
  categories: HttpTypes.StoreProductCategory[]
  categoryId?: string
  collections?: HttpTypes.StoreCollection[]
  collectionId?: string
  /** When set (e.g. "/store"), "All Departments" links here instead of clearing the filter */
  allDepartmentsHref?: string
  search?: boolean
  "data-testid"?: string
}

const RefinementList = ({
  sortBy,
  categories,
  categoryId,
  collections = [],
  collectionId: collectionIdProp,
  allDepartmentsHref,
  "data-testid": dataTestId,
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const priceMin = searchParams.get("priceMin")
  const priceMax = searchParams.get("priceMax")
  const priceRange = getPriceRangeValue(priceMin, priceMax)
  // On category page we use categoryId prop; on store page we use category_id from URL
  const facetCategoryId = categoryId || searchParams.get("category_id") || ""
  const facetCollectionId = collectionIdProp || searchParams.get("collection_id") || ""

  const setQueryParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(updates)) {
        if (value === "") params.delete(key)
        else params.set(key, value)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex flex-row flex-wrap items-center gap-4">
      <ProductFacets
        priceRange={priceRange}
        categoryId={facetCategoryId}
        categories={categories}
        collections={collections}
        collectionId={facetCollectionId}
        setQueryParams={setQueryParams}
        allDepartmentsHref={allDepartmentsHref}
        data-testid={dataTestId}
      />
    </div>
  )
}

export default RefinementList
export type { SortOptions } from "./sort-products"
