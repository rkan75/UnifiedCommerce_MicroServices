"use client"

import { Listbox, Transition } from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { Fragment, useCallback, useEffect, useState } from "react"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"
import { SortOptions } from "../sort-products"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

type SortProductsDropdownProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: SortOptions) => void
  "data-testid"?: string
}

const sortOptions: { value: SortOptions; labelKey: string }[] = [
  { value: "created_at", labelKey: "store.sortLatestArrivals" },
  { value: "price_asc", labelKey: "store.sortPriceLowHigh" },
  { value: "price_desc", labelKey: "store.sortPriceHighLow" },
]

export default function SortProductsDropdown({
  sortBy,
  setQueryParams,
  "data-testid": dataTestId,
}: SortProductsDropdownProps) {
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

  const selected = sortOptions.find((o) => o.value === sortBy) ?? sortOptions[0]

  return (
    <div className="relative" data-testid={dataTestId}>
      <Listbox
        value={sortBy}
        onChange={(value) => setQueryParams("sortBy", value)}
      >
        <Listbox.Button
          className={clx(
            "relative w-full min-w-[180px] flex justify-between items-center px-3 py-2 text-left bg-white cursor-default focus:outline-none border border-ui-border-base rounded-md text-sm text-ui-fg-base hover:bg-ui-bg-subtle"
          )}
        >
          {({ open }) => (
            <>
              <span className="block truncate">{t(selected.labelKey)}</span>
              <ChevronUpDown
                className={clx("ml-2 h-4 w-4 text-ui-fg-muted transition-transform", {
                  "rotate-180": open,
                })}
              />
            </>
          )}
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute right-0 z-50 mt-1 w-full min-w-[180px] overflow-auto bg-white border border-ui-border-base rounded-md shadow-lg max-h-60 focus:outline-none text-sm py-1">
            {sortOptions.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option.value}
                className={({ active }) =>
                  clx("cursor-default select-none relative py-2 pl-3 pr-9", {
                    "bg-ui-bg-base-hover": active,
                    "bg-ui-bg-highlight": option.value === sortBy,
                  })
                }
              >
                {({ selected: isSelected }) => (
                  <>
                    <span
                      className={clx("block truncate", {
                        "font-medium": isSelected,
                      })}
                    >
                      {t(option.labelKey)}
                    </span>
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                        ✓
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </div>
  )
}
