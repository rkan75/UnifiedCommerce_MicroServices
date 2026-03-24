"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import SortProductsDropdown from "@modules/store/components/refinement-list/sort-products-dropdown"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getTranslation } from "@lib/i18n/translations"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

type SortBarProps = {
  sortBy: SortOptions
}

export default function SortBar({ sortBy }: SortBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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

  const setQueryParams = useCallback(
    (name: string, value: SortOptions) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex justify-end w-full mb-4">
      <div className="flex items-center gap-2">
        <span className="txt-compact-small-plus text-ui-fg-muted whitespace-nowrap">{t("store.sortBy")}</span>
        <SortProductsDropdown sortBy={sortBy} setQueryParams={setQueryParams} />
      </div>
    </div>
  )
}
