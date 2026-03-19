"use client"

import { MapPin, MagnifyingGlass, XMark } from "@medusajs/icons"
import { Button, clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useCallback, useEffect, useState } from "react"
import { updateDeliveryZip } from "@lib/data/cart"
import { geocodeQuery } from "./geocode"
import type { StoreLocation } from "./store-finder-data"
import { getNearestStores } from "./store-finder-data"

const StoreFinderMap = dynamic(
  () => import("./store-finder-map").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[220px] rounded-md bg-ui-bg-subtle animate-pulse flex items-center justify-center text-ui-fg-muted txt-small">
        Loading map…
      </div>
    ),
  }
)

type FulfillmentOption = "pickup" | "delivery"

type UpdateLocationPanelProps = {
  isOpen: boolean
  onClose: () => void
  countryCode: string
  customer: HttpTypes.StoreCustomer | null
}

export default function UpdateLocationPanel({
  isOpen,
  onClose,
  countryCode,
  customer,
}: UpdateLocationPanelProps) {
  const router = useRouter()
  const [option, setOption] = useState<FulfillmentOption>("delivery")
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [nearestStores, setNearestStores] = useState<StoreLocation[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<HttpTypes.StoreCustomerAddress | null>(null)
  const [continuing, setContinuing] = useState(false)

  const addresses = customer?.addresses ?? []

  // Default to first (closest) store when nearest stores change
  useEffect(() => {
    if (nearestStores.length > 0) {
      setSelectedStore((prev) => {
        const first = nearestStores[0]
        if (!prev || !nearestStores.some((s) => s.id === prev.id)) return first
        return nearestStores.find((s) => s.id === prev.id) ?? first
      })
    } else {
      setSelectedStore(null)
    }
  }, [nearestStores])

  const runSearch = useCallback(
    async (lat: number, lng: number) => {
      setCenter({ lat, lng })
      const stores = getNearestStores(lat, lng, 3)
      setNearestStores(stores)
    },
    []
  )

  const handleSearchByQuery = useCallback(async () => {
    const q = (searchQuery || "").trim()
    if (!q) {
      setSearchError("Enter a zip code, city, or state.")
      return
    }
    setSearchError(null)
    setSearching(true)
    try {
      const result = await geocodeQuery(q, "us")
      if (result) {
        await runSearch(result.lat, result.lng)
      } else {
        setSearchError("Location not found. Try a different zip, city, or state.")
        setCenter(null)
        setNearestStores([])
      }
    } catch {
      setSearchError("Search failed. Please try again.")
      setCenter(null)
      setNearestStores([])
    } finally {
      setSearching(false)
    }
  }, [searchQuery, runSearch])

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setSearchError("Geolocation is not supported by your browser.")
      return
    }
    setSearchError(null)
    setSearching(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        runSearch(latitude, longitude)
        setSearching(false)
      },
      () => {
        setSearchError("Could not get your location. Check permissions or try search.")
        setSearching(false)
      }
    )
  }, [runSearch])

  const showMap = center && (nearestStores.length > 0 || center)

  const handleContinueStore = useCallback(async () => {
    if (!selectedStore) return
    setContinuing(true)
    try {
      const result = await updateDeliveryZip(countryCode, selectedStore.zip)
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setSearchError(result.error ?? "Failed to update location.")
      }
    } catch {
      setSearchError("Failed to update location.")
    } finally {
      setContinuing(false)
    }
  }, [countryCode, selectedStore, onClose, router])

  const handleContinueAddress = useCallback(async () => {
    if (!selectedAddress?.postal_code) return
    setContinuing(true)
    try {
      const result = await updateDeliveryZip(countryCode, selectedAddress.postal_code)
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setSearchError(result.error ?? "Failed to update location.")
      }
    } catch {
      setSearchError("Failed to update location.")
    } finally {
      setContinuing(false)
    }
  }, [countryCode, selectedAddress, onClose, router])

  return (
    <>
      {/* Backdrop */}
      <div
        className={clx(
          "fixed inset-0 bg-black/40 z-[70] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={clx(
          "fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-white shadow-xl z-[71] flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-location-panel-title"
      >
        <div className="flex items-center justify-between border-b border-ui-border-base p-4 shrink-0">
          <h2
            id="update-location-panel-title"
            className="text-lg font-semibold text-ui-fg-base"
          >
            Update Location
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base transition-colors"
            aria-label="Close panel"
          >
            <XMark className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          {/* Pickup or Delivery */}
          <div>
            <p className="txt-compact-medium-plus text-ui-fg-base mb-2">
              How would you like to receive your order?
            </p>
            <div className="flex rounded-lg border border-ui-border-base overflow-hidden">
              <button
                type="button"
                onClick={() => setOption("pickup")}
                className={clx(
                  "flex-1 py-2.5 px-4 txt-small-medium transition-colors",
                  option === "pickup"
                    ? "bg-ui-bg-base text-ui-fg-base border-r border-ui-border-base"
                    : "bg-ui-bg-subtle text-ui-fg-muted hover:bg-ui-bg-subtle-hover"
                )}
              >
                Pickup
              </button>
              <button
                type="button"
                onClick={() => setOption("delivery")}
                className={clx(
                  "flex-1 py-2.5 px-4 txt-small-medium transition-colors",
                  option === "delivery"
                    ? "bg-ui-bg-base text-ui-fg-base border-l border-ui-border-base"
                    : "bg-ui-bg-subtle text-ui-fg-muted hover:bg-ui-bg-subtle-hover"
                )}
              >
                Delivery
              </button>
            </div>
          </div>

          {/* Delivery: Sign in or select address */}
          {option === "delivery" && (
            <div className="flex flex-col gap-4">
              {!customer ? (
                <>
                  <h3 className="text-base font-semibold text-ui-fg-base">
                    Sign in to see your addresses
                  </h3>
                  <p className="text-sm text-ui-fg-muted">
                    Delivery options and delivery speeds may vary for different locations.
                  </p>
                  <LocalizedClientLink href="/account">
                    <Button className="w-full">Login</Button>
                  </LocalizedClientLink>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-ui-fg-base">
                    Your addresses
                  </h3>
                  {addresses.length === 0 ? (
                    <p className="text-sm text-ui-fg-muted">
                      No saved addresses. Add one in your account.
                    </p>
                  ) : (
                    <ul className="list-none flex flex-col gap-2">
                      {addresses.map((address) => (
                        <li key={address.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAddress(address)}
                            className={clx(
                              "w-full flex flex-col gap-1 p-3 rounded-md border text-left transition-colors",
                              selectedAddress?.id === address.id
                                ? "bg-ui-bg-base border-ui-border-interactive ring-2 ring-ui-border-interactive"
                                : "bg-ui-bg-subtle border-ui-border-base hover:border-ui-border-strong"
                            )}
                            aria-pressed={selectedAddress?.id === address.id}
                            aria-label={`Select address ${address.postal_code}`}
                          >
                            <span className="txt-small-medium text-ui-fg-base">
                              {address.first_name} {address.last_name}
                            </span>
                            <span className="txt-small text-ui-fg-muted">
                              {address.address_1}
                              {address.address_2 ? `, ${address.address_2}` : ""}
                            </span>
                            <span className="txt-small text-ui-fg-muted">
                              {address.postal_code}, {address.city}
                              {address.province ? `, ${address.province}` : ""}{" "}
                              {address.country_code?.toUpperCase()}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {/* Locate a store / Use current location — only for Pickup */}
          {option === "pickup" && (
            <>
              <div className="flex flex-col gap-2">
                <p className="txt-compact-medium-plus text-ui-fg-base">
                  Find a store
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("store-search")?.focus()}
                    className="flex items-center gap-2 text-ui-fg-interactive hover:text-ui-fg-interactive-hover txt-small-medium text-left"
                  >
                    <MagnifyingGlass className="w-4 h-4 shrink-0" />
                    Locate a store
                  </button>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={searching}
                    className="flex items-center gap-2 text-ui-fg-interactive hover:text-ui-fg-interactive-hover txt-small-medium text-left"
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    Use current location
                  </button>
                  <span className="txt-small text-ui-fg-muted">
                    or search by zip code, city, or state below
                  </span>
                </div>
              </div>

              {/* Search by Zip, city or state */}
              <div>
                <label htmlFor="store-search" className="sr-only">
                  Search by Zip code, city or state
                </label>
                <div className="flex rounded-md border border-ui-border-base bg-ui-bg-field hover:bg-ui-bg-field-hover focus-within:ring-2 focus-within:ring-ui-border-interactive focus-within:border-ui-border-interactive">
                  <input
                    id="store-search"
                    type="text"
                    placeholder="Search by Zip code, city or state"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setSearchError(null)
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchByQuery()}
                    className="flex-1 min-w-0 px-3 py-2.5 bg-transparent border-0 text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none txt-small-medium"
                  />
                  <button
                    type="button"
                    onClick={handleSearchByQuery}
                    disabled={searching}
                    className="p-2.5 text-ui-fg-muted hover:text-ui-fg-base hover:bg-ui-bg-subtle transition-colors rounded-r-md"
                    aria-label="Search for stores"
                  >
                    <MagnifyingGlass className="w-5 h-5" />
                  </button>
                </div>
                {searchError && (
                  <p className="mt-2 txt-small text-ui-fg-error" role="alert">
                    {searchError}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Map + Top 3 stores — only for Pickup */}
          {option === "pickup" && showMap && center && (
            <div className="flex flex-col gap-3">
              <p className="txt-compact-medium-plus text-ui-fg-base">
                Top 3 nearest stores
              </p>
              <StoreFinderMap
                center={center}
                stores={nearestStores}
                className="w-full overflow-hidden rounded-md border border-ui-border-base"
              />
              <ul className="list-none flex flex-col gap-2">
                {nearestStores.map((store, i) => (
                  <li key={store.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStore(store)}
                      className={clx(
                        "w-full flex gap-3 p-3 rounded-md border text-left transition-colors",
                        selectedStore?.id === store.id
                          ? "bg-ui-bg-base border-ui-border-interactive ring-2 ring-ui-border-interactive"
                          : "bg-ui-bg-subtle border-ui-border-base hover:border-ui-border-strong"
                      )}
                      aria-pressed={selectedStore?.id === store.id}
                      aria-label={`Select ${store.name}, ${store.zip}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ui-bg-base text-ui-fg-base txt-compact-small-plus font-semibold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="txt-small-medium text-ui-fg-base font-medium">
                          {store.name}
                        </p>
                        <p className="txt-small text-ui-fg-muted">
                          {store.address}, {store.city}, {store.state} {store.zip}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Continue button — Pickup: selected store; Delivery: selected address */}
        {option === "pickup" && showMap && selectedStore && (
          <div className="p-4 border-t border-ui-border-base bg-white shrink-0">
            <Button
              onClick={handleContinueStore}
              disabled={continuing}
              isLoading={continuing}
              className="w-full"
            >
              Continue — Delivering to {selectedStore.zip}
            </Button>
          </div>
        )}
        {option === "delivery" && customer && selectedAddress && (
          <div className="p-4 border-t border-ui-border-base bg-white shrink-0">
            <Button
              onClick={handleContinueAddress}
              disabled={continuing}
              isLoading={continuing}
              className="w-full"
            >
              Continue — Delivering to {selectedAddress.postal_code}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
