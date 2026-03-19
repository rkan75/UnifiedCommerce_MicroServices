import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@medusajs/ui"

type CategoryMenuBarProps = {
  categories: HttpTypes.StoreProductCategory[]
  className?: string
}

/** Kroger-style horizontal category menu. Uses root-level categories only. */
export default function CategoryMenuBar({
  categories,
  className,
}: CategoryMenuBarProps) {
  const rootCategories = (categories || []).filter(
    (c: HttpTypes.StoreProductCategory) => !c.parent_category && c.handle
  )

  if (rootCategories.length === 0) {
    return null
  }

  return (
    <div
      className={clx(
        "border-b border-ui-border-base bg-white",
        className
      )}
      role="navigation"
      aria-label="Shop by department"
    >
      <div className="content-container">
        <ul className="flex items-center gap-x-0 xsmall:gap-x-1 overflow-x-auto py-0 scrollbar-thin scrollbar-thumb-ui-border-base scrollbar-track-transparent">
          <li className="shrink-0">
            <LocalizedClientLink
              href="/store"
              className="block px-3 py-3 xsmall:px-4 text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-subtle text-xs xsmall:text-sm font-medium transition-colors whitespace-nowrap border-b-2 border-transparent hover:border-ui-fg-base min-h-[44px] flex items-center"
            >
              All Products
            </LocalizedClientLink>
          </li>
          {rootCategories.map((cat) => (
            <li key={cat.id} className="shrink-0">
              <LocalizedClientLink
                href={`/categories/${cat.handle}`}
                className="block px-3 py-3 xsmall:px-4 text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-subtle text-xs xsmall:text-sm font-medium transition-colors whitespace-nowrap border-b-2 border-transparent hover:border-ui-fg-base min-h-[44px] flex items-center"
              >
                {cat.name}
              </LocalizedClientLink>
            </li>
          ))}
          <li className="shrink-0">
            <LocalizedClientLink
              href="/recipes"
              className="block px-3 py-3 xsmall:px-4 text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-subtle text-xs xsmall:text-sm font-medium transition-colors whitespace-nowrap border-b-2 border-transparent hover:border-ui-fg-base min-h-[44px] flex items-center"
            >
              Recipes
            </LocalizedClientLink>
          </li>
          <li className="shrink-0">
            <LocalizedClientLink
              href="/weekly-ad"
              className="block px-3 py-3 xsmall:px-4 text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-subtle text-xs xsmall:text-sm font-medium transition-colors whitespace-nowrap border-b-2 border-transparent hover:border-ui-fg-base min-h-[44px] flex items-center"
            >
              Weekly Sales
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}
