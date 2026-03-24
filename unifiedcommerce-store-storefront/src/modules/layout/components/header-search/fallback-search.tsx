"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import type { HeaderSearchVariant } from "./types"

const PLACEHOLDER_DEFAULT = "Search products..."
const PLACEHOLDER_PROMINENT = "What can we help you find today?"

export default function FallbackSearch({
  className,
  variant = "default",
}: {
  className?: string
  variant?: HeaderSearchVariant
}) {
  const router = useRouter()
  const params = useParams()
  const countryCode = params?.countryCode as string
  const [value, setValue] = useState("")

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = (value || "").trim()
      if (q) {
        router.push(`/${countryCode}/store?q=${encodeURIComponent(q)}`)
      } else {
        router.push(`/${countryCode}/store`)
      }
    },
    [value, countryCode, router]
  )

  const isProminent = variant === "prominent"
  const placeholder = isProminent ? PLACEHOLDER_PROMINENT : PLACEHOLDER_DEFAULT

  return (
    <form
      onSubmit={handleSubmit}
      className={clx(
        "flex items-center w-full",
        isProminent ? "max-w-full" : "max-w-xl",
        className
      )}
      role="search"
    >
      <div
        className={clx(
          "relative flex-1 flex items-center bg-grey-0 border border-grey-20 transition-shadow focus-within:ring-2 focus-within:ring-header-red/30 focus-within:border-header-red/40",
          isProminent
            ? "rounded-full shadow-md hover:shadow-lg py-0.5 pr-3 pl-4"
            : "rounded-md hover:bg-ui-bg-subtle-hover focus-within:ring-ui-fg-base focus-within:border-transparent"
        )}
      >
        {!isProminent && (
          <span className="absolute left-3 text-ui-fg-muted pointer-events-none">
            <MagnifyingGlass className="w-5 h-5" />
          </span>
        )}
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={clx(
            "w-full bg-transparent border-0 text-grey-80 placeholder:text-grey-50 focus:outline-none focus:ring-0",
            isProminent ? "py-3 pl-0 pr-10 text-sm" : "pl-10 pr-4 py-2.5 text-sm"
          )}
          aria-label="Search products"
        />
        {isProminent && (
          <span className="absolute right-3.5 text-grey-80 pointer-events-none">
            <MagnifyingGlass className="w-5 h-5" />
          </span>
        )}
      </div>
      {!isProminent && (
        <button
          type="submit"
          className="ml-2 px-4 py-2.5 bg-ui-button-neutral hover:bg-ui-button-neutral-hover text-ui-button-neutral-text text-sm font-medium rounded-md transition-colors shrink-0"
        >
          Search
        </button>
      )}
    </form>
  )
}
