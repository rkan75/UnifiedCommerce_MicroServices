"use client"

import { useParams, useRouter } from "next/navigation"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { getTranslation } from "@lib/i18n/translations"

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
  allDepartmentsHref?: string
  "data-testid"?: string
}

export default function FilterSidebar({
  categories,
  categoryId,
  allDepartmentsHref,
  "data-testid": dataTestId,
}: FilterSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const countryCode = (params?.countryCode as string) || "us"

  const [locale, setLocale] = useState<"en" | "es">(() => {
    if (typeof window !== "undefined") {
      const cookieLocale = getCookie("_medusa_locale")
      if (cookieLocale) {
        const lang = cookieLocale.split("-")[0].toLowerCase()
        return lang === "es" ? "es" : "en"
      }
    }
    return "en"
  })

  useEffect(() => {
    const updateLocale = () => {
      if (typeof window === "undefined") return
      const cookieLocale = getCookie("_medusa_locale")
      let newLocale: "en" | "es" = "en"
      if (cookieLocale) {
        const lang = cookieLocale.split("-")[0].toLowerCase()
        newLocale = lang === "es" ? "es" : "en"
      }
      setLocale(newLocale)
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

  const hasActiveFilters = !!priceRange || !!facetCategoryId

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
      params.set("page", "1")
      const qs = params.toString()
      router.push(`/${countryCode}${allDepartmentsHref}${qs ? `?${qs}` : ""}`)
    } else {
      setQueryParams({ priceMin: "", priceMax: "", category_id: "", page: "1" })
    }
  }

  const rootCategories = (categories || []).filter(
    (c: HttpTypes.StoreProductCategory) => !c.parent_category && c.handle
  )

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
        params.set("page", "1")
        const qs = params.toString()
        router.push(`/${countryCode}${allDepartmentsHref}${qs ? `?${qs}` : ""}`)
      } else {
        setQueryParams({ category_id: "", page: "1" })
      }
    } else {
      const cat = rootCategories.find((c) => c.id === value)
      if (cat && allDepartmentsHref) {
        router.push(`/${countryCode}/categories/${cat.handle}`)
      } else if (cat) {
        setQueryParams({ category_id: cat.id, page: "1" })
      }
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
          {rootCategories.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => handleDepartmentClick(cat.id)}
                className={clx(
                  "w-full text-left py-2.5 tablet:py-1.5 px-0 text-sm rounded hover:bg-ui-bg-base-hover focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-1 min-h-[44px] tablet:min-h-0 flex items-center",
                  facetCategoryId === cat.id ? "text-ui-fg-interactive font-medium" : "text-ui-fg-subtle"
                )}
              >
                {cat.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
