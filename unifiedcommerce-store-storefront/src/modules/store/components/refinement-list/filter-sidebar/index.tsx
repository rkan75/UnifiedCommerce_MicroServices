"use client"

import { useParams, useRouter } from "next/navigation"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"
import {
  departmentFacetEntries,
  findCategoryInTree,
} from "@lib/util/plp-department-categories"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

export type PriceRangeOption = {
  value: string
  labelKey: string
  priceMin?: number
  priceMax?: number
}

// Price ranges in dollars (Medusa Store API returns calculated_amount in major unit)
const PRICE_RANGE_OPTIONS: PriceRangeOption[] = [
  { value: "", labelKey: "store.allPrices" },
  { value: "0-5", labelKey: "store.priceUnder5", priceMin: 0, priceMax: 5 },
  { value: "5-10", labelKey: "store.price5to10", priceMin: 5, priceMax: 10 },
  { value: "10-25", labelKey: "store.price10to25", priceMin: 10, priceMax: 25 },
  { value: "25-", labelKey: "store.price25AndAbove", priceMin: 25, priceMax: undefined },
]

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

type FilterSidebarProps = {
  categories: HttpTypes.StoreProductCategory[]
  categoryId?: string
  collections?: HttpTypes.StoreCollection[]
  collectionId?: string
  allDepartmentsHref?: string
  "data-testid"?: string
}

export default function FilterSidebar({
  categories,
  categoryId,
  collections = [],
  collectionId: collectionIdProp,
  allDepartmentsHref,
  "data-testid": dataTestId,
}: FilterSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const countryCode = (params?.countryCode as string) || "us"

  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return resolveTranslationLocale(getCookie("_medusa_locale"))
    }
    return "en"
  })

  useEffect(() => {
    const updateLocale = () => {
      if (typeof window === "undefined") return
      setLocale(resolveTranslationLocale(getCookie("_medusa_locale")))
    }
    updateLocale()
    const handleLocaleChange = () => updateLocale()
    window.addEventListener("localechange", handleLocaleChange)
    return () => window.removeEventListener("localechange", handleLocaleChange)
  }, [])

  const t = useCallback((key: string) => getTranslation(locale, key), [locale])

  const priceMin = searchParams.get("priceMin")
  const priceMax = searchParams.get("priceMax")
  const priceRange = getPriceRangeValue(priceMin, priceMax)
  const facetCategoryId = categoryId || searchParams.get("category_id") || ""
  const facetCollectionId = collectionIdProp || searchParams.get("collection_id") || ""

  const hasActiveFilters = !!priceRange || !!facetCategoryId || !!facetCollectionId

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

  const clearAllFilters = () => {
    if (allDepartmentsHref && facetCategoryId) {
      const params = new URLSearchParams(searchParams)
      params.delete("category_id")
      params.delete("collection_id")
      params.delete("brands")
      params.delete("hw_categories")
      params.set("page", "1")
      const qs = params.toString()
      router.push(`/${countryCode}${allDepartmentsHref}${qs ? `?${qs}` : ""}`)
    } else {
      setQueryParams({
        priceMin: "",
        priceMax: "",
        category_id: "",
        collection_id: "",
        brands: "",
        hw_categories: "",
        page: "1",
      })
    }
  }

  const facetEntries = departmentFacetEntries(categories || [])

  const handlePriceClick = (opt: PriceRangeOption) => {
    if (opt.value === "") {
      setQueryParams({ priceMin: "", priceMax: "", page: "1" })
    } else {
      setQueryParams({
        priceMin: opt.priceMin !== undefined ? String(opt.priceMin) : "",
        priceMax: opt.priceMax !== undefined ? String(opt.priceMax) : "",
        page: "1",
      })
    }
  }

  const handleDepartmentClick = (value: string) => {
    if (value === "") {
      if (allDepartmentsHref) {
        const params = new URLSearchParams(searchParams)
        params.delete("category_id")
        params.delete("brands")
        params.delete("hw_categories")
        params.set("page", "1")
        const qs = params.toString()
        router.push(`/${countryCode}${allDepartmentsHref}${qs ? `?${qs}` : ""}`)
      } else {
        setQueryParams({
          category_id: "",
          brands: "",
          hw_categories: "",
          page: "1",
        })
      }
    } else {
      const cat = findCategoryInTree(categories || [], value)
      if (cat?.handle && allDepartmentsHref) {
        const qs = new URLSearchParams()
        if (facetCollectionId) qs.set("collection_id", facetCollectionId)
        const suffix = qs.toString()
        router.push(
          `/${countryCode}/categories/${cat.handle}${suffix ? `?${suffix}` : ""}`
        )
      } else if (cat?.id) {
        setQueryParams({ category_id: cat.id, page: "1" })
      }
    }
  }

  const handleCollectionClick = (value: string) => {
    if (value === "") {
      setQueryParams({ collection_id: "", page: "1" })
    } else {
      setQueryParams({ collection_id: value, page: "1" })
    }
  }

  return (
    <aside
      className="w-full tablet:w-56 shrink-0 border-b tablet:border-b-0 tablet:border-r border-ui-border-base pb-4 tablet:pb-6 pr-0 tablet:pr-6"
      data-testid={dataTestId}
      aria-label="Filter menu"
    >
      {/* Filters header - Target style */}
      <div className="flex items-center justify-between mb-3 tablet:mb-4 pb-3 border-b border-ui-border-base">
        <h2 className="text-sm tablet:text-base font-semibold text-ui-fg-base">{t("store.filters")}</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-ui-fg-interactive hover:underline focus:outline-none"
          >
            {t("store.clearAll")}
          </button>
        )}
      </div>

      {/* Price section - Target style filter list */}
      <div className="mb-4 tablet:mb-6">
        <h3 className="text-xs tablet:text-sm font-semibold text-ui-fg-base mb-2 tablet:mb-3">{t("store.price")}</h3>
        <ul className="space-y-0.5">
          {PRICE_RANGE_OPTIONS.map((opt) => (
            <li key={opt.value || "all"}>
              <button
                type="button"
                onClick={() => handlePriceClick(opt)}
                className={clx(
                  "w-full text-left py-2.5 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                  opt.value === priceRange
                    ? "text-ui-fg-interactive font-medium"
                    : "text-ui-fg-subtle"
                )}
              >
                {t(opt.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Department section - Target style filter list */}
      <div>
        <h3 className="text-xs tablet:text-sm font-semibold text-ui-fg-base mb-2 tablet:mb-3">{t("store.department")}</h3>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => handleDepartmentClick("")}
              className={clx(
                "w-full text-left py-2.5 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                !facetCategoryId ? "text-ui-fg-interactive font-medium" : "text-ui-fg-subtle"
              )}
            >
              {t("store.allDepartments")}
            </button>
          </li>
          {facetEntries.map(({ department, hwSubcategories }) => (
            <li key={department.id}>
              <button
                type="button"
                onClick={() => handleDepartmentClick(department.id)}
                className={clx(
                  "w-full text-left py-2.5 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                  facetCategoryId === department.id
                    ? "text-ui-fg-interactive font-medium"
                    : "text-ui-fg-subtle"
                )}
              >
                {department.name}
              </button>
              {hwSubcategories.length > 0 && (
                <ul className="mt-0.5 mb-1 ml-1 pl-3 border-l border-ui-border-base space-y-0.5">
                  {hwSubcategories.map((sub) => (
                    <li key={sub.id}>
                      <button
                        type="button"
                        onClick={() => handleDepartmentClick(sub.id)}
                        className={clx(
                          "w-full text-left py-2 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                          facetCategoryId === sub.id
                            ? "text-ui-fg-interactive font-medium"
                            : "text-ui-fg-muted"
                        )}
                      >
                        {sub.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      {collections.length > 0 && (
        <div className="mt-4 tablet:mt-6">
          <h3 className="text-xs tablet:text-sm font-semibold text-ui-fg-base mb-2 tablet:mb-3">
            {t("store.collection")}
          </h3>
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => handleCollectionClick("")}
                className={clx(
                  "w-full text-left py-2.5 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                  !facetCollectionId ? "text-ui-fg-interactive font-medium" : "text-ui-fg-subtle"
                )}
              >
                {t("store.allCollections")}
              </button>
            </li>
            {collections.map((col) => (
              <li key={col.id}>
                <button
                  type="button"
                  onClick={() => handleCollectionClick(col.id)}
                  className={clx(
                    "w-full text-left py-2.5 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                    facetCollectionId === col.id
                      ? "text-ui-fg-interactive font-medium"
                      : "text-ui-fg-subtle"
                  )}
                >
                  {col.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
