"use client"

import { useState, useRef, useEffect } from "react"
import { MagnifyingGlass, XMark } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import {
  useHits,
  useSearchBox,
  useInstantSearch,
  Configure,
} from "react-instantsearch"
import {
  searchClient,
  ALGOLIA_INDEX_NAME,
  isAlgoliaConfigured,
} from "@lib/algolia/config"
import { InstantSearch } from "react-instantsearch"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import FallbackSearch from "@modules/layout/components/header-search/fallback-search"
import type { HeaderSearchVariant } from "@modules/layout/components/header-search/types"

type SearchResult = {
  objectID: string
  id: string
  title: string
  handle: string
  thumbnail?: string
  collection_handle?: string
  collection_title?: string
}

function SearchBox({ variant = "default" }: { variant?: HeaderSearchVariant }) {
  const { query, refine, clear } = useSearchBox()
  const [inputValue, setInputValue] = useState(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const isProminent = variant === "prominent"

  useEffect(() => {
    setInputValue(query)
  }, [query])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    refine(inputValue)
  }

  const handleReset = () => {
    setInputValue("")
    clear()
    inputRef.current?.focus()
  }

  const placeholder = isProminent
    ? "What can we help you find today?"
    : "Search products..."

  return (
    <form onSubmit={handleSubmit} className="relative flex-1">
      <div
        className={clx(
          "relative flex items-center bg-grey-0 border border-grey-20 transition-shadow",
          isProminent
            ? "rounded-full shadow-md hover:shadow-lg py-0.5 pl-4 pr-3 focus-within:ring-2 focus-within:ring-header-red/30 focus-within:border-header-red/40"
            : "rounded-md bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover border-ui-border-base focus-within:ring-2 focus-within:ring-ui-fg-base focus-within:border-transparent"
        )}
      >
        {!isProminent && (
          <span className="absolute left-3 text-ui-fg-muted pointer-events-none">
            <MagnifyingGlass className="w-5 h-5" />
          </span>
        )}
        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            refine(e.target.value)
          }}
          placeholder={placeholder}
          className={clx(
            "w-full bg-transparent border-0 text-grey-80 focus:outline-none focus:ring-0 text-sm",
            isProminent
              ? "py-3 pl-0 pr-16 placeholder:text-grey-50"
              : "pl-10 pr-10 py-2.5 text-ui-fg-base placeholder:text-ui-fg-muted"
          )}
          aria-label="Search products"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleReset}
            className={clx(
              "absolute text-ui-fg-muted hover:text-ui-fg-base transition-colors",
              isProminent ? "right-10" : "right-3"
            )}
            aria-label="Clear search"
          >
            <XMark className="w-4 h-4" />
          </button>
        )}
        {isProminent && (
          <span className="absolute right-3.5 text-grey-80 pointer-events-none">
            <MagnifyingGlass className="w-5 h-5" />
          </span>
        )}
      </div>
    </form>
  )
}

function SearchResults({ onSelect }: { onSelect?: () => void }) {
  const { hits } = useHits<SearchResult>()
  const { query } = useSearchBox()
  const { status } = useInstantSearch()
  const trimmedQuery = (query || "").trim()

  const isLoading = status === "loading" || status === "stalled"
  const showEmptyState = !trimmedQuery
  const showNoResults = trimmedQuery && hits.length === 0 && !isLoading

  const handleSelect = () => {
    onSelect?.()
  }

  return (
    <>
      {isLoading && (
        <div className="p-4 text-center text-ui-fg-subtle text-sm border-b border-ui-border-base">
          Searching...
        </div>
      )}
      {showEmptyState && !isLoading && (
        <div className="p-4 text-center text-ui-fg-subtle text-sm">
          Type to search products
        </div>
      )}
      {showNoResults && (
        <div className="p-4 text-center text-ui-fg-subtle text-sm">
          No products found for &quot;{trimmedQuery}&quot;
        </div>
      )}
      {hits.length > 0 && (
        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="divide-y divide-ui-border-base">
            {hits.map((hit) => (
              <li key={hit.objectID || hit.id || hit.handle}>
                <LocalizedClientLink
                  href={`/products/${hit.handle}`}
                  className="flex items-center gap-4 p-4 hover:bg-ui-bg-subtle-hover transition-colors"
                  onClick={handleSelect}
                >
                  <div className="relative w-16 h-16 shrink-0 bg-ui-bg-subtle rounded-md overflow-hidden">
                    {hit.thumbnail ? (
                      <Thumbnail thumbnail={hit.thumbnail} size="square" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ui-fg-muted text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-ui-fg-base line-clamp-2">
                      {hit.title}
                    </h3>
                    {(hit.collection_title || hit.collection_handle) && (
                      <p className="text-xs text-ui-fg-subtle mt-1">
                        {hit.collection_title || hit.collection_handle}
                      </p>
                    )}
                  </div>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
          {trimmedQuery && (
            <div className="p-2 border-t border-ui-border-base">
              <LocalizedClientLink
                href={`/store?q=${encodeURIComponent(trimmedQuery)}`}
                className="block text-center text-sm text-ui-fg-interactive hover:text-ui-fg-interactive-hover py-2"
                onClick={handleSelect}
              >
                View all results for &quot;{trimmedQuery}&quot;
              </LocalizedClientLink>
            </div>
          )}
        </div>
      )}
    </>
  )
}

type AlgoliaSearchProps = {
  className?: string
  variant?: HeaderSearchVariant
}

export default function AlgoliaSearch({
  className,
  variant = "default",
}: AlgoliaSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Handle Algolia errors gracefully
  useEffect(() => {
    if (!searchClient) return

    const originalRequest = searchClient.search
    searchClient.search = async function (requests: any[]) {
      try {
        return await originalRequest.call(this, requests)
      } catch (error: any) {
        // Check for referer/API key errors
        if (
          error?.message?.includes("referer") ||
          error?.message?.includes("Method not allowed") ||
          error?.status === 403 ||
          error?.status === 401
        ) {
          console.warn(
            "[Algolia] API error detected, falling back to basic search:",
            error.message
          )
          setHasError(true)
          // Return empty results to prevent UI errors
          return {
            results: requests.map(() => ({
              hits: [],
              nbHits: 0,
              page: 0,
              nbPages: 0,
            })),
          }
        }
        throw error
      }
    }
  }, [searchClient])

  if (!isAlgoliaConfigured) {
    return null
  }
  if (!searchClient || hasError) {
    return <FallbackSearch className={className} variant={variant} />
  }

  return (
    <div
      ref={containerRef}
      className={clx(
        "relative w-full max-w-full",
        variant === "prominent" ? "tablet:max-w-2xl" : "tablet:max-w-xl",
        className
      )}
    >
      <InstantSearch
        searchClient={searchClient}
        indexName={ALGOLIA_INDEX_NAME}
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <Configure hitsPerPage={10} />
        <div className="relative">
          <div onClick={() => setIsOpen(true)}>
            <SearchBox variant={variant} />
          </div>
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-ui-bg-base border border-ui-border-base rounded-lg shadow-elevation-card-hover z-50 overflow-hidden w-full min-w-[280px] max-h-[85vh] overflow-y-auto">
              <SearchResults onSelect={() => setIsOpen(false)} />
            </div>
          )}
        </div>
      </InstantSearch>
    </div>
  )
}
