"use client"

import { MapPin, XMark } from "@medusajs/icons"
import { Button, clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useCallback, useEffect, useState } from "react"
import {
  applyHeaderDeliverySavedAddressAndStore,
  updateDeliveryZip,
  type DeliveryAddressInput,
} from "@lib/data/cart"
import {
  getDeliveryFulfillmentStoreCount,
  getDeliveryFulfillmentStoreLookupEnabled,
} from "@lib/config/delivery-fulfillment"
import {
  getStoreLocations,
  type StoreLocationApi,
} from "@lib/data/store-locations"
import {
  formatStoreDistanceMiles,
  getStoreLocatorNearestCount,
} from "@lib/config/store-locator"
import { geocodeQuery } from "./geocode"
import StoreDetailsModal from "./store-details-modal"
import type { StoreLocation } from "./store-finder-data"
import {
  filterStoresByLocationQuery,
  resolveNearestStoresForCenter,
} from "./store-finder-data"

type FulfillmentOption = "pickup" | "delivery"

type UpdateLocationPanelProps = {
  isOpen: boolean
  onClose: () => void
  countryCode: string
  customer: HttpTypes.StoreCustomer | null
  initialZip?: string | null
}

function storeDirectionsUrl(store: StoreLocation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`
}

function normalizeZip(z: string | null | undefined): string {
  return (z ?? "").replace(/\D/g, "").slice(0, 5)
}

function toDeliveryStoreInput(s: StoreLocation) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    state: s.state,
    zip: s.zip,
  }
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12h12" />
      <path d="M6 16h12" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
    </svg>
  )
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export default function UpdateLocationPanel({
  isOpen,
  onClose,
  countryCode,
  customer,
  initialZip = null,
}: UpdateLocationPanelProps) {
  const router = useRouter()
  const [option, setOption] = useState<FulfillmentOption>("delivery")
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [nearestStores, setNearestStores] = useState<StoreLocation[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null)
  const [selectedAddress, setSelectedAddress] =
    useState<HttpTypes.StoreCustomerAddress | null>(null)
  const [continuing, setContinuing] = useState(false)
  const [apiStores, setApiStores] = useState<Awaited<
    ReturnType<typeof getStoreLocations>
  >>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [geocodedPostcode, setGeocodedPostcode] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [detailsStore, setDetailsStore] = useState<StoreLocation | null>(null)
  const [guestZipInput, setGuestZipInput] = useState("")
  const [deliveryFulfillmentStores, setDeliveryFulfillmentStores] = useState<
    StoreLocation[]
  >([])
  const [deliveryFulfillmentLoading, setDeliveryFulfillmentLoading] =
    useState(false)
  const [selectedDeliveryFulfillmentStore, setSelectedDeliveryFulfillmentStore] =
    useState<StoreLocation | null>(null)

  const addresses = customer?.addresses ?? []
  const savedZip = normalizeZip(initialZip)
  const deliveryFulfillmentLookup = getDeliveryFulfillmentStoreLookupEnabled()

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("")
      setSearchError(null)
      setCenter(null)
      setNearestStores([])
      setSelectedStore(null)
      setGeocodedPostcode(null)
      setSelectedAddress(null)
      setHasSearched(false)
      setDetailsStore(null)
      setOption("delivery")
      setGuestZipInput(initialZip?.replace(/\D/g, "").slice(0, 5) ?? "")
      setDeliveryFulfillmentStores([])
      setSelectedDeliveryFulfillmentStore(null)
      setDeliveryFulfillmentLoading(false)
      return
    }
    setGuestZipInput((prev) => {
      const fromCart = initialZip?.replace(/\D/g, "").slice(0, 5) ?? ""
      return fromCart || prev
    })
  }, [isOpen, initialZip])

  useEffect(() => {
    if (option === "delivery") {
      setNearestStores([])
      setHasSearched(false)
      setCenter(null)
      setSelectedStore(null)
      setGeocodedPostcode(null)
      setSearchQuery("")
      setSearchError(null)
      setDetailsStore(null)
    }
    if (option === "pickup") {
      setDeliveryFulfillmentStores([])
      setSelectedDeliveryFulfillmentStore(null)
      setDeliveryFulfillmentLoading(false)
    }
  }, [option])

  useEffect(() => {
    if (!isOpen) return
    const needStores =
      option === "pickup" ||
      (option === "delivery" && deliveryFulfillmentLookup)
    if (!needStores) return

    let cancelled = false
    setStoresLoading(true)
    getStoreLocations().then((rows) => {
      if (!cancelled) {
        setApiStores(rows)
        setStoresLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, option, deliveryFulfillmentLookup])

  useEffect(() => {
    if (!isOpen || option !== "delivery" || !deliveryFulfillmentLookup) {
      setDeliveryFulfillmentStores([])
      setDeliveryFulfillmentLoading(false)
      setSelectedDeliveryFulfillmentStore(null)
      return
    }

    const guestZipOk = !customer && guestZipInput.replace(/\D/g, "").length === 5
    const hasSavedSelection = Boolean(customer && selectedAddress)

    if (!guestZipOk && !hasSavedSelection) {
      setDeliveryFulfillmentStores([])
      setDeliveryFulfillmentLoading(false)
      setSelectedDeliveryFulfillmentStore(null)
      return
    }

    let cancelled = false
    setDeliveryFulfillmentLoading(true)
    setSearchError(null)

    ;(async () => {
      try {
        let geo = null
        if (selectedAddress) {
          const q = [
            selectedAddress.address_1,
            selectedAddress.city,
            selectedAddress.province,
            selectedAddress.postal_code,
            selectedAddress.country_code || "US",
          ]
            .filter(Boolean)
            .join(", ")
          geo = await geocodeQuery(q, "us")
        } else {
          geo = await geocodeQuery(guestZipInput.trim(), "us")
        }
        if (cancelled) return
        if (!geo || apiStores.length === 0) {
          setDeliveryFulfillmentStores([])
          setDeliveryFulfillmentLoading(false)
          return
        }
        const qText =
          selectedAddress?.postal_code?.trim() || guestZipInput.trim() || "delivery"
        const stores = await resolveNearestStoresForCenter(
          apiStores,
          geo.lat,
          geo.lng,
          qText,
          getDeliveryFulfillmentStoreCount()
        )
        if (cancelled) return
        setDeliveryFulfillmentStores(stores)
      } catch {
        if (!cancelled) setDeliveryFulfillmentStores([])
      } finally {
        if (!cancelled) setDeliveryFulfillmentLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    option,
    deliveryFulfillmentLookup,
    customer,
    selectedAddress,
    guestZipInput,
    apiStores,
  ])

  useEffect(() => {
    if (deliveryFulfillmentStores.length === 0) {
      setSelectedDeliveryFulfillmentStore(null)
      return
    }
    setSelectedDeliveryFulfillmentStore((prev) => {
      if (prev && deliveryFulfillmentStores.some((s) => s.id === prev.id))
        return prev
      return deliveryFulfillmentStores[0]
    })
  }, [deliveryFulfillmentStores])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (detailsStore) {
        setDetailsStore(null)
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose, detailsStore])

  useEffect(() => {
    if (nearestStores.length > 0) {
      setSelectedStore((prev) => {
        if (savedZip.length === 5) {
          const zipMatch = nearestStores.find(
            (s) => normalizeZip(s.zip) === savedZip
          )
          if (zipMatch) return zipMatch
        }
        const first = nearestStores[0]
        if (!prev || !nearestStores.some((s) => s.id === prev.id)) return first
        return nearestStores.find((s) => s.id === prev.id) ?? first
      })
    } else {
      setSelectedStore(null)
    }
  }, [nearestStores, savedZip])

  const runSearch = useCallback(
    async (lat: number, lng: number, queryText: string) => {
      setCenter({ lat, lng })
      setHasSearched(true)
      if (apiStores.length === 0) {
        setNearestStores([])
        return
      }
      const stores = await resolveNearestStoresForCenter(
        apiStores,
        lat,
        lng,
        queryText,
        getStoreLocatorNearestCount()
      )
      setNearestStores(stores)
    },
    [apiStores]
  )

  const handleFindStores = useCallback(async () => {
    const q = (searchQuery || "").trim()
    if (!q) {
      setSearchError("Enter a zip code, city, or state.")
      return
    }
    setSearchError(null)
    setSearching(true)
    setGeocodedPostcode(null)
    try {
      const result = await geocodeQuery(q, "us")
      if (result) {
        setGeocodedPostcode(result.postcode ?? null)
        await runSearch(result.lat, result.lng, q)
      } else if (apiStores.length > 0) {
        const inRegion = filterStoresByLocationQuery(apiStores, q)
        const withCoords = inRegion.filter(
          (s): s is StoreLocationApi & { lat: number; lng: number } =>
            s.lat != null &&
            s.lng != null &&
            Number.isFinite(s.lat) &&
            Number.isFinite(s.lng)
        )
        if (withCoords.length > 0) {
          const lat =
            withCoords.reduce((acc, s) => acc + s.lat, 0) / withCoords.length
          const lng =
            withCoords.reduce((acc, s) => acc + s.lng, 0) / withCoords.length
          setGeocodedPostcode(null)
          await runSearch(lat, lng, q)
        } else {
          setSearchError(
            "Location not found. Try a ZIP, full city name, or state (e.g. CA or California)."
          )
          setCenter(null)
          setNearestStores([])
          setHasSearched(true)
        }
      } else {
        setSearchError("Location not found. Try a different zip, city, or state.")
        setCenter(null)
        setNearestStores([])
        setHasSearched(true)
      }
    } catch {
      setSearchError("Search failed. Please try again.")
      setCenter(null)
      setNearestStores([])
      setHasSearched(true)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, runSearch, apiStores])

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setSearchError("Geolocation is not supported by your browser.")
      return
    }
    setSearchError(null)
    setGeocodedPostcode(null)
    setSearching(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        await runSearch(latitude, longitude, searchQuery.trim())
        setSearching(false)
      },
      () => {
        setSearchError("Could not get your location. Check permissions or try search.")
        setSearching(false)
      }
    )
  }, [runSearch, searchQuery])

  const handleContinueZip = useCallback(
    async (zip: string) => {
      const z = zip.replace(/\D/g, "").slice(0, 5)
      if (z.length < 5) {
        setSearchError("A valid 5-digit ZIP is required.")
        return
      }
      setContinuing(true)
      try {
        const result = await updateDeliveryZip(countryCode, z)
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
    },
    [countryCode, onClose, router]
  )

  const handleContinueStore = useCallback(async () => {
    if (!selectedStore?.zip) return
    await handleContinueZip(selectedStore.zip)
  }, [handleContinueZip, selectedStore])

  const handleContinueGeocodedZip = useCallback(async () => {
    if (!geocodedPostcode) return
    await handleContinueZip(geocodedPostcode)
  }, [geocodedPostcode, handleContinueZip])

  const handleApplyDelivery = useCallback(async () => {
    const storeMeta =
      deliveryFulfillmentLookup && selectedDeliveryFulfillmentStore
        ? toDeliveryStoreInput(selectedDeliveryFulfillmentStore)
        : null

    if (customer && selectedAddress?.postal_code) {
      setContinuing(true)
      setSearchError(null)
      try {
        if (
          deliveryFulfillmentLookup &&
          deliveryFulfillmentStores.length > 0 &&
          !storeMeta
        ) {
          setSearchError("Select a fulfillment store to continue.")
          setContinuing(false)
          return
        }
        if (storeMeta) {
          const addr: DeliveryAddressInput = {
            first_name: selectedAddress.first_name || "—",
            last_name: selectedAddress.last_name || "—",
            address_1: selectedAddress.address_1 || "—",
            city: selectedAddress.city || "—",
            postal_code: selectedAddress.postal_code,
            country_code: selectedAddress.country_code || countryCode,
            province: selectedAddress.province || "",
            phone: selectedAddress.phone || "",
            company: selectedAddress.company || "",
          }
          const r = await applyHeaderDeliverySavedAddressAndStore(
            addr,
            storeMeta,
            customer.email ?? undefined
          )
          if (r.success) {
            router.refresh()
            onClose()
          } else {
            setSearchError(r.error ?? "Failed to update delivery.")
          }
        } else {
          const r = await updateDeliveryZip(
            countryCode,
            selectedAddress.postal_code,
            null
          )
          if (r.success) {
            router.refresh()
            onClose()
          } else {
            setSearchError(r.error ?? "Failed to update location.")
          }
        }
      } catch {
        setSearchError("Failed to update delivery.")
      } finally {
        setContinuing(false)
      }
      return
    }

    const z = guestZipInput.replace(/\D/g, "").slice(0, 5)
    if (!customer && z.length === 5) {
      setContinuing(true)
      setSearchError(null)
      try {
        if (
          deliveryFulfillmentLookup &&
          deliveryFulfillmentStores.length > 0 &&
          !storeMeta
        ) {
          setSearchError("Select a fulfillment store to continue.")
          setContinuing(false)
          return
        }
        const r = await updateDeliveryZip(countryCode, z, storeMeta)
        if (r.success) {
          router.refresh()
          onClose()
        } else {
          setSearchError(r.error ?? "Failed to update location.")
        }
      } catch {
        setSearchError("Failed to update location.")
      } finally {
        setContinuing(false)
      }
    }
  }, [
    countryCode,
    customer,
    deliveryFulfillmentLookup,
    deliveryFulfillmentStores.length,
    guestZipInput,
    onClose,
    router,
    selectedAddress,
    selectedDeliveryFulfillmentStore,
  ])

  const guestZipOk = !customer && guestZipInput.replace(/\D/g, "").length === 5
  const deliveryStorePickRequired =
    deliveryFulfillmentLookup &&
    !deliveryFulfillmentLoading &&
    deliveryFulfillmentStores.length > 0
  const deliveryContinueBlocked =
    deliveryFulfillmentLookup &&
    (Boolean(selectedAddress) || guestZipOk) &&
    deliveryFulfillmentLoading

  const showContinuePickupStore =
    option === "pickup" && hasSearched && selectedStore
  const showContinueDeliveryAddress =
    option === "delivery" &&
    customer &&
    selectedAddress &&
    !deliveryContinueBlocked &&
    (!deliveryStorePickRequired || Boolean(selectedDeliveryFulfillmentStore))
  const showContinueGeocoded =
    option === "pickup" &&
    hasSearched &&
    !selectedStore &&
    geocodedPostcode &&
    geocodedPostcode.replace(/\D/g, "").length >= 5
  const showContinueGuestZip =
    option === "delivery" &&
    !customer &&
    guestZipOk &&
    !deliveryContinueBlocked &&
    (!deliveryStorePickRequired || Boolean(selectedDeliveryFulfillmentStore))

  const showFooter =
    showContinuePickupStore ||
    showContinueDeliveryAddress ||
    showContinueGeocoded ||
    showContinueGuestZip

  const panelTitle =
    option === "delivery" ? "Delivery address" : "Select store for pickup"

  return (
    <>
      <div
        className={clx(
          "fixed inset-0 bg-black/40 z-[70] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={clx(
          "fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-white shadow-xl z-[71] flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-panel-title"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 shrink-0">
          <h2
            id="location-panel-title"
            className={clx(
              "text-lg font-bold tracking-tight",
              option === "delivery" ? "text-header-red" : "text-neutral-900"
            )}
          >
            {panelTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-md hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors"
            aria-label="Close panel"
          >
            <XMark className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          <div>
            <p className="text-sm font-semibold text-neutral-900 mb-2">
              How would you like to shop?
            </p>
            <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setOption("delivery")}
                className={clx(
                  "flex-1 py-2.5 px-4 text-sm font-medium transition-colors",
                  option === "delivery"
                    ? "bg-white text-neutral-900 border-r border-neutral-200"
                    : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                )}
              >
                Shop for delivery
              </button>
              <button
                type="button"
                onClick={() => setOption("pickup")}
                className={clx(
                  "flex-1 py-2.5 px-4 text-sm font-medium transition-colors",
                  option === "pickup"
                    ? "bg-white text-neutral-900 border-l border-neutral-200"
                    : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                )}
              >
                Pickup
              </button>
            </div>
          </div>

          {option === "pickup" && (
            <>
              <div>
                <label
                  htmlFor="store-search"
                  className="block text-sm font-medium text-neutral-900 mb-2"
                >
                  Enter Zip, City or State
                </label>
                <div className="flex gap-2 items-stretch">
                  <input
                    id="store-search"
                    type="text"
                    placeholder="Zip, City or State"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setSearchError(null)
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleFindStores()}
                    disabled={searching || storesLoading}
                    className="flex-1 min-w-0 px-3 py-2.5 border border-neutral-300 rounded text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={handleFindStores}
                    disabled={searching || storesLoading}
                    className="shrink-0 px-4 py-2.5 bg-neutral-900 text-white text-xs font-semibold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {searching ? "…" : "Find stores"}
                  </button>
                </div>
                {searchError && option === "pickup" && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {searchError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={searching}
                  className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800 disabled:opacity-50"
                >
                  <MapPin className="w-4 h-4 shrink-0" aria-hidden />
                  Use my current location
                </button>
                {storesLoading && (
                  <p className="mt-2 text-xs text-neutral-500">Loading store list…</p>
                )}
              </div>

              {hasSearched && nearestStores.length > 0 && (
                <ul className="list-none flex flex-col divide-y divide-neutral-200 border-t border-neutral-200 -mx-5">
                  {nearestStores.map((store) => {
                    const selected = selectedStore?.id === store.id
                    const myStore = selected
                    const dist = formatStoreDistanceMiles(store.distanceMiles)
                    const hoursLine =
                      store.openingHours && dist
                        ? `${store.openingHours} • ${dist}`
                        : store.openingHours
                          ? store.openingHours
                          : dist
                            ? dist
                            : null
                    const phoneDigits = store.phone?.replace(/\D/g, "") ?? ""
                    const phoneHref =
                      phoneDigits.length >= 10
                        ? `tel:+1${phoneDigits.slice(-10)}`
                        : store.phone
                          ? `tel:${store.phone.replace(/\s/g, "")}`
                          : null

                    return (
                      <li key={store.id} className="px-5 py-4">
                        <div className="flex gap-3">
                          <input
                            type="radio"
                            name="select-store"
                            id={`store-${store.id}`}
                            checked={selected}
                            onChange={() => setSelectedStore(store)}
                            className="mt-1.5 h-4 w-4 shrink-0 border-neutral-400 text-neutral-900 focus:ring-neutral-900"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <label
                                  htmlFor={`store-${store.id}`}
                                  className="font-bold text-neutral-900 cursor-pointer"
                                >
                                  {store.name}
                                </label>
                                {myStore && (
                                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                                    My store
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setDetailsStore(store)}
                                className="text-sm text-blue-600 underline shrink-0"
                              >
                                Store details
                              </button>
                            </div>
                            {hoursLine && (
                              <p className="mt-1 text-sm text-neutral-600">{hoursLine}</p>
                            )}
                            <div className="mt-2 flex gap-2 text-sm text-neutral-800">
                              <IconBuilding className="shrink-0 text-neutral-500 mt-0.5" />
                              <div className="min-w-0 flex-1 flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                                <span>
                                  {store.address}, {store.city}, {store.state}{" "}
                                  {store.zip}
                                </span>
                                <a
                                  href={storeDirectionsUrl(store)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline shrink-0"
                                >
                                  Get directions
                                </a>
                              </div>
                            </div>
                            {store.phone && (
                              <div className="mt-2 flex items-center gap-2 text-sm text-neutral-800">
                                <IconPhone className="shrink-0 text-neutral-500" />
                                {phoneHref ? (
                                  <a href={phoneHref} className="text-blue-600 underline">
                                    {store.phone}
                                  </a>
                                ) : (
                                  <span>{store.phone}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {hasSearched && nearestStores.length === 0 && !searching && (
                <p className="text-sm text-neutral-600">
                  {apiStores.length === 0
                    ? "No store locations are available yet. Configure stores in Medusa (store locator module) and reload."
                    : "No stores found for this search. Try a different ZIP, city, or state."}
                </p>
              )}
            </>
          )}

          {option === "delivery" && (
            <div className="flex flex-col gap-4 border-t border-neutral-200 pt-6 text-header-red">
              <p className="text-sm">
                {deliveryFulfillmentLookup ? (
                  <>
                    Select a saved address or enter a new delivery address.
                    We&apos;ll show you the top stores by inventory availability
                    for that location.
                  </>
                ) : (
                  <>
                    Choose a saved address or add a new one in your account.
                    Your delivery area is based on the address you select.
                  </>
                )}
              </p>
              {!customer ? (
                <>
                  <div>
                    <label
                      htmlFor="guest-delivery-zip"
                      className="block text-sm font-medium mb-2"
                    >
                      Or enter a 5-digit delivery ZIP
                    </label>
                    <input
                      id="guest-delivery-zip"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="ZIP code"
                      value={guestZipInput}
                      onChange={(e) => {
                        setGuestZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))
                        setSearchError(null)
                      }}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded text-sm text-header-red placeholder:text-header-red/50 focus:outline-none focus:ring-2 focus:ring-header-red focus:border-header-red"
                    />
                  </div>
                  {searchError && (
                    <p className="text-sm !text-red-600" role="alert">
                      {searchError}
                    </p>
                  )}
                  <LocalizedClientLink href="/account">
                    <Button className="w-full">Sign in to use saved addresses</Button>
                  </LocalizedClientLink>
                  <LocalizedClientLink
                    href="/account"
                    className="text-sm text-header-red underline text-center"
                  >
                    Add a new address in your account
                  </LocalizedClientLink>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    Your addresses
                  </p>
                  {addresses.length === 0 ? (
                    <p className="text-sm opacity-90">
                      You don&apos;t have any saved addresses yet.
                    </p>
                  ) : null}
                  {addresses.length > 0 && (
                    <ul className="list-none flex flex-col gap-2">
                      {addresses.map((address) => (
                        <li key={address.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAddress(address)}
                            className={clx(
                              "w-full flex flex-col gap-1 p-3 rounded-md border text-left transition-colors text-sm",
                              selectedAddress?.id === address.id
                                ? "bg-white border-neutral-900 ring-2 ring-neutral-900 ring-offset-1"
                                : "bg-neutral-50 border-neutral-200 hover:border-neutral-400"
                            )}
                            aria-pressed={selectedAddress?.id === address.id}
                          >
                            <span className="font-medium">
                              {address.first_name} {address.last_name}
                            </span>
                            <span className="opacity-90">
                              {address.address_1}
                              {address.address_2 ? `, ${address.address_2}` : ""}
                            </span>
                            <span className="opacity-90">
                              {address.postal_code}, {address.city}
                              {address.province ? `, ${address.province}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <LocalizedClientLink
                    href="/account"
                    className="text-sm underline"
                  >
                    Add a new address in your account
                  </LocalizedClientLink>
                  {searchError && (
                    <p className="text-sm !text-red-600" role="alert">
                      {searchError}
                    </p>
                  )}
                </>
              )}

              {deliveryFulfillmentLookup &&
                (selectedAddress || guestZipOk) && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-3">
                    <p className="text-sm font-semibold">
                      Fulfillment location
                    </p>
                    <p className="text-sm opacity-90">
                      Top locations for your delivery area (ranked by proximity;
                      availability may vary by item).
                    </p>
                    {deliveryFulfillmentLoading && (
                      <p className="text-sm opacity-75">
                        Finding stores…
                      </p>
                    )}
                    {!deliveryFulfillmentLoading &&
                      deliveryFulfillmentStores.length > 0 && (
                        <ul className="list-none flex flex-col gap-3">
                          {deliveryFulfillmentStores.map((store) => {
                            const checked =
                              selectedDeliveryFulfillmentStore?.id === store.id
                            return (
                              <li key={store.id}>
                                <label className="flex gap-3 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="delivery-fulfillment-store"
                                    checked={checked}
                                    onChange={() =>
                                      setSelectedDeliveryFulfillmentStore(
                                        store
                                      )
                                    }
                                    className="mt-1 h-4 w-4 shrink-0 border-neutral-400 text-header-red focus:ring-header-red"
                                  />
                                  <span className="min-w-0">
                                    <span className="font-medium block">
                                      {store.name}
                                    </span>
                                    <span className="text-sm opacity-90">
                                      {store.address}, {store.city},{" "}
                                      {store.state} {store.zip}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    {!deliveryFulfillmentLoading &&
                      deliveryFulfillmentStores.length === 0 && (
                        <p className="text-sm opacity-90">
                          No store locations matched this area. You can still
                          continue with your delivery ZIP or address.
                        </p>
                      )}
                  </div>
                )}
            </div>
          )}
        </div>

        {showFooter && (
          <div className="p-5 border-t border-neutral-200 bg-white shrink-0">
            {showContinuePickupStore && (
              <button
                type="button"
                onClick={handleContinueStore}
                disabled={continuing}
                className="w-full py-3 bg-neutral-900 text-white text-sm font-semibold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50"
              >
                {continuing ? "Please wait…" : `Continue — ${selectedStore!.zip}`}
              </button>
            )}
            {showContinueDeliveryAddress && (
              <button
                type="button"
                onClick={handleApplyDelivery}
                disabled={continuing}
                className="w-full py-3 bg-neutral-900 text-white text-sm font-semibold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50"
              >
                {continuing
                  ? "Please wait…"
                  : `Continue — ${selectedAddress!.postal_code}`}
              </button>
            )}
            {showContinueGeocoded &&
              !showContinuePickupStore &&
              !showContinueDeliveryAddress && (
                <button
                  type="button"
                  onClick={handleContinueGeocodedZip}
                  disabled={continuing}
                  className="w-full py-3 bg-neutral-900 text-white text-sm font-semibold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50"
                >
                  {continuing ? "Please wait…" : `Continue — ZIP ${geocodedPostcode}`}
                </button>
              )}
            {showContinueGuestZip &&
              !showContinueDeliveryAddress &&
              !showContinueGeocoded && (
                <button
                  type="button"
                  onClick={handleApplyDelivery}
                  disabled={continuing}
                  className="w-full py-3 bg-neutral-900 text-white text-sm font-semibold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50"
                >
                  {continuing ? "Please wait…" : `Continue — ${guestZipInput}`}
                </button>
              )}
          </div>
        )}
      </div>

      {detailsStore && (
        <StoreDetailsModal
          store={detailsStore}
          onClose={() => setDetailsStore(null)}
        />
      )}
    </>
  )
}
