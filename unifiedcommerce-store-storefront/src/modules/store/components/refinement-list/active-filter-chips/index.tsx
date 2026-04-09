"use client"

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { clx } from "@medusajs/ui"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

const PRICE_LABEL_KEYS: Record<string, string> = {
  "0-5": "store.priceUnder5",
  "5-10": "store.price5to10",
  "10-25": "store.price10to25",
  "25-": "store.price25AndAbove",
}

function getPriceRangeLabel(priceMin: string | null, priceMax: string | null): string | null {
  const min = priceMin != null && priceMin !== "" ? parseFloat(priceMin) : undefined
  const max = priceMax != null && priceMax !== "" ? parseFloat(priceMax) : undefined
  if (min === undefined && max === undefined) return null
  if (min === 0 && max === 5) return "0-5"
  if (min === 5 && max === 10) return "5-10"
  if (min === 10 && max === 25) return "10-25"
  if (min === 25 && max === undefined) return "25-"
  return null
}

type ActiveFilterChipsProps = {
  categoryName?: string | null
  collectionName?: string | null
  /** When on category page, pass e.g. "/store" so clearing department navigates to store */
  allDepartmentsHref?: string
}

export default function ActiveFilterChips({
  categoryName,
  collectionName,
  allDepartmentsHref,
}: ActiveFilterChipsProps) {
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
  const priceKey = getPriceRangeLabel(priceMin, priceMax)
  const priceLabel = priceKey ? t(PRICE_LABEL_KEYS[priceKey]) : null
  const categoryId = searchParams.get("category_id")
  const collectionId = searchParams.get("collection_id")
  const hasDepartmentFilter = !!categoryId
  const hasCollectionFilter = !!collectionId
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

  const removePrice = () => setQueryParams({ priceMin: "", priceMax: "", page: "1" })
  const removeCollection = () => setQueryParams({ collection_id: "", page: "1" })

  const removeDepartment = () => {
    if (allDepartmentsHref) {
      const params = new URLSearchParams(searchParams)
      params.delete("category_id")
      params.delete("brands")
      params.delete("hw_categories")
      params.set("page", "1")
      const qs = params.toString()
      router.push(`/${countryCode}${allDepartmentsHref}${qs ? `?${qs}` : ""}`)
    } else {
      setQueryParams({ category_id: "", brands: "", hw_categories: "", page: "1" })
    }
  }

  const hasFilters =
    !!priceLabel || !!categoryName || hasDepartmentFilter || hasCollectionFilter
  if (!hasFilters) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {priceLabel && (
        <span
          className={clx(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-ui-bg-base border border-ui-border-base text-ui-fg-subtle"
          )}
        >
          {t("store.price")}: {priceLabel}
          <button
            type="button"
            onClick={removePrice}
            className="hover:text-ui-fg-base focus:outline-none ml-0.5"
            aria-label={t("store.removePriceFilter")}
          >
            ×
          </button>
        </span>
      )}
      {(categoryName || hasDepartmentFilter) && (
        <span
          className={clx(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-ui-bg-base border border-ui-border-base text-ui-fg-subtle"
          )}
        >
          {categoryName ?? t("store.departmentLabel")}
          <button
            type="button"
            onClick={removeDepartment}
            className="hover:text-ui-fg-base focus:outline-none ml-0.5"
            aria-label={t("store.removeDepartmentFilter")}
          >
            ×
          </button>
        </span>
      )}
      {hasCollectionFilter && (
        <span
          className={clx(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-ui-bg-base border border-ui-border-base text-ui-fg-subtle"
          )}
        >
          {collectionName ?? t("store.collection")}
          <button
            type="button"
            onClick={removeCollection}
            className="hover:text-ui-fg-base focus:outline-none ml-0.5"
            aria-label={t("store.removeCollectionFilter")}
          >
            ×
          </button>
        </span>
      )}
    </div>
  )
}
