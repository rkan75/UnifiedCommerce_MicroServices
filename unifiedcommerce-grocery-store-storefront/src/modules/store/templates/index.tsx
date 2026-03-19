import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import ActiveFilterChips from "@modules/store/components/refinement-list/active-filter-chips"
import FilterSidebar from "@modules/store/components/refinement-list/filter-sidebar"
import RefinementList from "@modules/store/components/refinement-list"
import SortBar from "@modules/store/components/sort-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  q,
  countryCode,
  categoryId,
  priceMin,
  priceMax,
}: {
  sortBy?: SortOptions
  page?: string
  q?: string
  countryCode: string
  categoryId?: string
  priceMin?: string
  priceMax?: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const categories = await listCategories().catch(() => [])
  const categoryName = categoryId
    ? (categories || []).find((c) => c.id === categoryId)?.name
    : undefined

  return (
    <div
      className="flex flex-col small:flex-row small:items-start gap-4 small:gap-6 py-4 small:py-6 content-container"
      data-testid="category-container"
    >
      {/* Filter sidebar: desktop only (small+) */}
      <aside className="hidden small:block shrink-0" aria-label="Filters">
        <FilterSidebar
          categories={categories || []}
          categoryId={categoryId}
          data-testid="filter-sidebar"
        />
      </aside>

      {/* Main content: title, filter dropdowns (mobile/tablet), chips, sort, product grid */}
      <div className="flex-1 min-w-0 w-full">
        <div className="mb-3 small:mb-4 text-xl-semi tablet:text-2xl-semi">
          <h1 data-testid="store-page-title">
            {q ? (
              <>
                Search results for &quot;<span className="font-semibold">{q}</span>&quot;
              </>
            ) : (
              "All products"
            )}
          </h1>
        </div>
        {/* Price + Department dropdowns: mobile and tablet only; desktop uses sidebar */}
        <div className="flex small:hidden flex-wrap items-center gap-3 mb-3">
          <RefinementList
            sortBy={sort}
            categories={categories || []}
            categoryId={categoryId}
            data-testid="refinement-list-mobile"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 small:gap-4 mb-3 small:mb-4">
          <ActiveFilterChips categoryName={categoryName} />
          <SortBar sortBy={sort} />
        </div>
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            q={q}
            countryCode={countryCode}
            categoryId={categoryId}
            priceMin={priceMin}
            priceMax={priceMax}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default StoreTemplate
