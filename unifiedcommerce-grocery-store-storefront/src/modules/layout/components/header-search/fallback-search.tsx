"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useState } from "react"

const PLACEHOLDER = "Search products..."

export default function FallbackSearch({ className }: { className?: string }) {
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

  return (
    <form
      onSubmit={handleSubmit}
      className={clx("flex items-center w-full max-w-xl", className)}
      role="search"
    >
      <div className="relative flex-1 flex items-center bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover border border-ui-border-base rounded-md transition-colors focus-within:ring-2 focus-within:ring-ui-fg-base focus-within:border-transparent">
        <span className="absolute left-3 text-ui-fg-muted pointer-events-none">
          <MagnifyingGlass className="w-5 h-5" />
        </span>
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDER}
          className="w-full pl-10 pr-4 py-2.5 bg-transparent border-0 text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-0 text-sm"
          aria-label="Search products"
        />
      </div>
      <button
        type="submit"
        className="ml-2 px-4 py-2.5 bg-ui-button-neutral hover:bg-ui-button-neutral-hover text-ui-button-neutral-text text-sm font-medium rounded-md transition-colors shrink-0"
      >
        Search
      </button>
    </form>
  )
}
