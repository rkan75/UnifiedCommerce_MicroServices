"use client"

import { useCallback, useEffect, useState } from "react"
import { MapPin } from "@medusajs/icons"
import { Button, Text } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { getStoreLocations } from "@lib/data/store-locations"
import { geocodeQueryWithVariants } from "@modules/layout/components/delivery-location/geocode"
import {
  resolveNearestStoresForCenter,
  formatStoreDistanceMiles,
  filterStoresByLocationQuery,
  mockStoresAsApiFallback,
  buildStoreLocationsFromTextMatches,
  type StoreLocation,
  type StoreLocationFromApi,
} from "@modules/layout/components/delivery-location/store-finder-data"
import { getStoreLocatorNearestCount } from "@lib/config/store-locator"
import PickupStoresMap from "./pickup-stores-map"
import { matchPickupShippingOption } from "@modules/checkout/util/match-pickup-shipping-option"
import { clx } from "@medusajs/ui"

type StorePickerMode = "pickup" | "in_store_list"

type CheckoutPickupStorePickerProps = {
  pickupMethods: HttpTypes.StoreCartShippingOption[]
  selectedStoreLocatorId: string | null
  onSelectStoreForPickup: (
    store: StoreLocation,
    shippingOption: HttpTypes.StoreCartShippingOption
  ) => void
  /** When `in_store_list`, all directory stores are selectable (no shipping option match). */
  mode?: StorePickerMode
  onSelectStoreForInStoreList?: (store: StoreLocation) => void
  /** Locator page accent (in_store_list defaults to red). */
  locatorAccent?: "green" | "red"
  /** Prominent search card + labels (dedicated pickup store locator page). */
  layout?: "default" | "locatorPage"
  /** Prefix for input id to avoid duplicate ids across pages. */
  inputIdPrefix?: string
}

export default function CheckoutPickupStorePicker({
  pickupMethods,
  selectedStoreLocatorId,
  onSelectStoreForPickup,
  mode = "pickup",
  onSelectStoreForInStoreList,
  locatorAccent: locatorAccentProp,
  layout = "default",
  inputIdPrefix = "checkout-pickup",
}: CheckoutPickupStorePickerProps) {
  const searchInputId = `${inputIdPrefix}-search`
  const isLocatorPage = layout === "locatorPage"
  const isInStoreList = mode === "in_store_list"
  const locatorAccent =
    locatorAccentProp ?? (isInStoreList ? "red" : "green")
  const accentHex = locatorAccent === "red" ? "#D10022" : "#006F46"
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [apiStores, setApiStores] = useState<StoreLocationFromApi[]>([])
  const [storesLoading, setStoresLoading] = useState(true)
  const [nearestStores, setNearestStores] = useState<StoreLocation[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStoresLoading(true)
    getStoreLocations().then((rows) => {
      if (!cancelled) {
        setApiStores(
          rows.length ? (rows as StoreLocationFromApi[]) : mockStoresAsApiFallback()
        )
        setStoresLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFindStores = useCallback(async () => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchError("Enter a ZIP code, city, or state.")
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const limit = getStoreLocatorNearestCount()
      const directory =
        apiStores.length > 0 ? apiStores : mockStoresAsApiFallback()

      const matched = filterStoresByLocationQuery(directory, q)
      let stores: StoreLocation[] = []

      const geo = await geocodeQueryWithVariants(q, "us")
      if (geo) {
        stores = await resolveNearestStoresForCenter(
          directory,
          geo.lat,
          geo.lng,
          q,
          limit
        )
      }

      if (stores.length === 0 && matched.length) {
        const first = matched[0]
        const anchorQ = [first.zip, first.city, first.state, "USA"]
          .filter(Boolean)
          .join(", ")
        const geo2 = await geocodeQueryWithVariants(anchorQ, "us")
        if (geo2) {
          stores = await resolveNearestStoresForCenter(
            directory,
            geo2.lat,
            geo2.lng,
            q,
            limit
          )
        }
      }

      if (stores.length === 0 && matched.length) {
        const pool: StoreLocationFromApi[] = matched
        const withCoords = pool.filter(
          (s): s is StoreLocationFromApi & { lat: number; lng: number } =>
            s.lat != null &&
            s.lng != null &&
            Number.isFinite(s.lat) &&
            Number.isFinite(s.lng)
        )
        if (withCoords.length) {
          const geo3 = await geocodeQueryWithVariants(
            `${withCoords[0].city}, ${withCoords[0].state}, USA`,
            "us"
          )
          if (geo3) {
            stores = await resolveNearestStoresForCenter(
              withCoords,
              geo3.lat,
              geo3.lng,
              q,
              limit
            )
          }
        }
      }

      if (stores.length === 0 && matched.length) {
        stores = await buildStoreLocationsFromTextMatches(matched, limit)
      }

      setNearestStores(stores)
      setHasSearched(true)
      if (stores.length === 0) {
        setSearchError(
          directory.length === 0
            ? "No store locations are configured yet."
            : "No stores match that search."
        )
      }
    } catch {
      setSearchError("Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }, [apiStores, searchQuery])

  const searchSection = (
    <>
      {!isLocatorPage && (
        <Text className="text-small-regular text-ui-fg-subtle">
          Search by ZIP code, city, or state. We&apos;ll show the nearest
          locations and match your pickup to the store.
        </Text>
      )}

      <div
        className={isLocatorPage ? "rounded-xl border-2 bg-ui-bg-subtle/40 p-5 shadow-sm" : ""}
        style={
          isLocatorPage
            ? { borderColor: `${accentHex}40` }
            : undefined
        }
      >
        <label
          htmlFor={searchInputId}
          className={
            isLocatorPage
              ? clx(
                  "block text-base font-semibold mb-3",
                  locatorAccent === "red"
                    ? "text-header-red"
                    : "text-ui-fg-base"
                )
              : "block text-sm font-medium text-ui-fg-base mb-2"
          }
        >
          {isLocatorPage
            ? "Search by city, state, or ZIP code"
            : "Location"}
        </label>
        {!isLocatorPage && (
          <Text className="text-xs text-ui-fg-muted mb-2 -mt-1">
            Enter a city, state abbreviation, or ZIP code.
          </Text>
        )}
        <div className="flex gap-3 items-stretch flex-col small:flex-row flex-wrap">
          <input
            id={searchInputId}
            type="text"
            name="store-locator-query"
            autoComplete="postal-code"
            placeholder={
              isLocatorPage
                ? "e.g. 10001, Austin TX, or California"
                : "ZIP, city, or state"
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchError(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && handleFindStores()}
            disabled={searching || storesLoading}
            className={
              isLocatorPage
                ? clx(
                    "flex-1 min-w-0 min-h-[48px] px-4 py-3 border-2 border-ui-border-base rounded-lg text-base text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2",
                    locatorAccent === "red"
                      ? "focus:border-header-red focus:ring-header-red/30"
                      : "focus:border-[#006F46] focus:ring-[#006F46]/30"
                  )
                : "flex-1 min-w-[200px] px-3 py-2.5 border border-ui-border-base rounded-md text-sm"
            }
          />
          <Button
            type="button"
            onClick={handleFindStores}
            disabled={searching || storesLoading}
            isLoading={searching}
            className={
              isLocatorPage
                ? clx(
                    "small:w-auto w-full min-h-[48px] px-8 text-base font-semibold shrink-0 !text-white border-0 hover:!opacity-90",
                    locatorAccent === "red" ? "!bg-header-red" : "!bg-[#006F46]"
                  )
                : undefined
            }
          >
            Find stores
          </Button>
        </div>
        {storesLoading && (
          <p className="mt-3 text-sm text-ui-fg-muted">Loading store directory…</p>
        )}
        {!storesLoading && isLocatorPage && (
          <p className="mt-3 text-xs text-ui-fg-muted">
            Results use your store locator data (nearest locations first).
          </p>
        )}
        {searchError && (
          <p
            className={
              isLocatorPage
                ? "mt-3 text-sm text-ui-fg-muted"
                : "mt-3 text-sm text-red-600"
            }
            role="status"
          >
            {searchError}
          </p>
        )}
      </div>
    </>
  )

  /** When empty, every store row gets no option — list is browse-only until Medusa returns pickup rates. */
  const noPickupShippingMethods = !isInStoreList && pickupMethods.length === 0

  return (
    <div className="flex flex-col gap-6">
      {searchSection}

      {hasSearched && nearestStores.length > 0 && (
        <>
          <PickupStoresMap
            stores={nearestStores}
            selectedId={selectedStoreLocatorId}
            accent={locatorAccent === "red" ? "red" : "green"}
            onSelectStore={(store) => {
              if (isInStoreList) {
                onSelectStoreForInStoreList?.(store)
                return
              }
              const opt = matchPickupShippingOption(store, pickupMethods)
              if (opt) onSelectStoreForPickup(store, opt)
            }}
          />

          {noPickupShippingMethods && (
            <div
              className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3 text-sm text-ui-fg-base"
              role="status"
            >
              <strong className="font-semibold">Pickup isn’t available for this cart yet.</strong>{" "}
              Stores listed here come from your directory; checkout must return at least one pickup
              shipping method before you can select a location. In Medusa, enable pickup for this
              region and sales channel (fulfillment set + shipping option), then refresh this page.
            </div>
          )}

          <ul className="list-none flex flex-col divide-y divide-ui-border-base border border-ui-border-base rounded-lg overflow-hidden">
            {nearestStores.map((store) => {
              const opt = matchPickupShippingOption(store, pickupMethods)
              const selected = selectedStoreLocatorId === store.id
              const dist = formatStoreDistanceMiles(store.distanceMiles)
              const canPickPickup =
                Boolean(opt) && !opt?.insufficient_inventory
              const disabled = isInStoreList ? false : !canPickPickup
              return (
                <li key={store.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (isInStoreList) {
                        onSelectStoreForInStoreList?.(store)
                        return
                      }
                      if (opt) onSelectStoreForPickup(store, opt)
                    }}
                    className={clx(
                      "w-full flex gap-3 text-left px-4 py-3 transition-colors",
                      selected &&
                        (locatorAccent === "red"
                          ? "bg-red-50 border-l-4 border-l-header-red"
                          : "bg-green-50 border-l-4 border-l-[#006F46]"),
                      !selected && "hover:bg-ui-bg-subtle",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <MapPin className="w-5 h-5 shrink-0 text-ui-fg-muted mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ui-fg-base">{store.name}</div>
                      <div className="text-sm text-ui-fg-muted">
                        {store.address}, {store.city}, {store.state} {store.zip}
                        {dist ? ` · ${dist}` : ""}
                      </div>
                      {!isInStoreList && opt?.insufficient_inventory && (
                        <div className="text-xs text-red-600 mt-1">
                          Unavailable for inventory at this time.
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
