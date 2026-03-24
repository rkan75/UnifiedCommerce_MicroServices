import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import ActiveFilterChips from "@modules/store/components/refinement-list/active-filter-chips"
import FilterSidebar from "@modules/store/components/refinement-list/filter-sidebar"
import SortBar from "@modules/store/components/sort-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"

export default async function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const categories = await listCategories({ limit: 100 }, countryCode).catch(
    () => []
  )

  return (
    <div className="flex flex-col small:flex-row small:items-start gap-6 py-6 content-container">
      <FilterSidebar categories={categories || []} data-testid="filter-sidebar" />
      <div className="flex-1 min-w-0 w-full">
        <div className="mb-4 text-2xl-semi">
          <h1>{collection.title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <ActiveFilterChips />
          <SortBar sortBy={sort} />
        </div>
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={collection.products?.length}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            collectionId={collection.id}
            countryCode={countryCode}
          />
        </Suspense>
      </div>
    </div>
  )
}
