import { notFound } from "next/navigation"
import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import InteractiveLink from "@modules/common/components/interactive-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import ActiveFilterChips from "@modules/store/components/refinement-list/active-filter-chips"
import FilterSidebar from "@modules/store/components/refinement-list/filter-sidebar"
import RefinementList from "@modules/store/components/refinement-list"
import SortBar from "@modules/store/components/sort-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  priceMin,
  priceMax,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  priceMin?: string
  priceMax?: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const categories = await listCategories().catch(() => [])
  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (cat: HttpTypes.StoreProductCategory) => {
    if (cat.parent_category) {
      parents.push(cat.parent_category)
      getParents(cat.parent_category)
    }
  }

  getParents(category)

  return (
    <div
      className="flex flex-col small:flex-row small:items-start gap-4 small:gap-6 py-4 small:py-6 content-container"
      data-testid="category-container"
    >
      {/* Filter sidebar: desktop only (small+) */}
      <aside className="hidden small:block shrink-0" aria-label="Filters">
        <FilterSidebar
          categories={categories || []}
          categoryId={category.id}
          allDepartmentsHref="/store"
          data-testid="filter-sidebar"
        />
      </aside>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-col xsmall:flex-row mb-3 small:mb-4 text-xl-semi tablet:text-2xl-semi gap-2 xsmall:gap-4">
          {parents &&
            parents.map((parent) => (
              <span key={parent.id} className="text-ui-fg-subtle">
                <LocalizedClientLink
                  className="mr-4 hover:text-black"
                  href={`/categories/${parent.handle}`}
                  data-testid="sort-by-link"
                >
                  {parent.name}
                </LocalizedClientLink>
                /
              </span>
            ))}
          <h1 data-testid="category-page-title">{category.name}</h1>
        </div>
        {category.description && (
          <div className="mb-4 text-base-regular">
            <p>{category.description}</p>
          </div>
        )}
        {category.category_children && (
          <div className="mb-4 text-base-large">
            <ul className="grid grid-cols-1 gap-2">
              {category.category_children?.map((c) => (
                <li key={c.id}>
                  <InteractiveLink href={`/categories/${c.handle}`}>
                    {c.name}
                  </InteractiveLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Price + Department dropdowns: mobile and tablet only; desktop uses sidebar */}
        <div className="flex small:hidden flex-wrap items-center gap-3 mb-3">
          <RefinementList
            sortBy={sort}
            categories={categories || []}
            categoryId={category.id}
            allDepartmentsHref="/store"
            data-testid="refinement-list-mobile"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 small:gap-4 mb-3 small:mb-4">
          <ActiveFilterChips
            categoryName={category.name}
            allDepartmentsHref="/store"
          />
          <SortBar sortBy={sort} />
        </div>
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryId={category.id}
            countryCode={countryCode}
            priceMin={priceMin}
            priceMax={priceMax}
          />
        </Suspense>
      </div>
    </div>
  )
}
