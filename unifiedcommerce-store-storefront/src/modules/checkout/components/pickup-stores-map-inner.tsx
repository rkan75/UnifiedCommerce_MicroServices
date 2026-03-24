"use client"

import { useEffect } from "react"
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { StoreLocation } from "@modules/layout/components/delivery-location/store-finder-data"

/**
 * Leaflet reads pixel positions from the map pane. Calling fitBounds before the
 * container has non-zero size (common with next/dynamic + rAF) throws
 * `_leaflet_pos` TypeErrors.
 */
function tryFitBounds(
  map: L.Map,
  bounds: L.LatLngBounds,
  opts: L.FitBoundsOptions
) {
  try {
    const container = map.getContainer?.()
    if (!container?.isConnected) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (w < 2 || h < 2) return
    map.invalidateSize(false)
    if (bounds.isValid()) {
      map.fitBounds(bounds, opts)
    }
  } catch {
    /* ignore races during unmount or incomplete map init */
  }
}

function FitBounds({ stores }: { stores: StoreLocation[] }) {
  const map = useMap()

  useEffect(() => {
    if (stores.length === 0) return
    const valid = stores.filter(
      (s) =>
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        Math.abs(s.lat) <= 90 &&
        Math.abs(s.lng) <= 180
    )
    if (valid.length === 0) return
    const bounds = L.latLngBounds(
      valid.map((s) => [s.lat, s.lng] as [number, number])
    )
    if (!bounds.isValid()) return

    const opts: L.FitBoundsOptions = { padding: [28, 28], maxZoom: 11 }
    let cancelled = false

    const run = () => {
      if (cancelled) return
      tryFitBounds(map, bounds, opts)
    }

    const afterLayout = () => {
      if (cancelled) return
      requestAnimationFrame(() => {
        requestAnimationFrame(run)
      })
    }

    map.whenReady(afterLayout)
    const t1 = window.setTimeout(run, 150)
    const t2 = window.setTimeout(run, 450)

    return () => {
      cancelled = true
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [stores, map])

  return null
}

function InvalidateOnContainerResize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    if (!el || typeof ResizeObserver === "undefined") return

    const ro = new ResizeObserver(() => {
      try {
        map.invalidateSize(false)
      } catch {
        /* ignore */
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

type PickupStoresMapInnerProps = {
  stores: StoreLocation[]
  selectedId: string | null
  onSelectStore: (store: StoreLocation) => void
  accent?: "red" | "green"
}

const US_CENTER: [number, number] = [39.8283, -98.5795]
const BRAND_RED = "#D10022"
const BRAND_RED_SELECTED = "#b91c1c"
const BRAND_GREEN = "#006F46"

export default function PickupStoresMapInner({
  stores,
  selectedId,
  onSelectStore,
  accent = "green",
}: PickupStoresMapInnerProps) {
  const valid = stores.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      Math.abs(s.lat) <= 90 &&
      Math.abs(s.lng) <= 180
  )
  const center: [number, number] =
    valid.length > 0 ? [valid[0].lat, valid[0].lng] : US_CENTER

  return (
    <div className="h-[min(280px,50vh)] w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
      <MapContainer
        center={center}
        zoom={valid.length ? 10 : 4}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateOnContainerResize />
        {valid.length > 0 && <FitBounds stores={valid} />}
        {valid.map((s) => {
          const selected = selectedId === s.id
          const stroke =
            accent === "red"
              ? selected
                ? BRAND_RED_SELECTED
                : BRAND_RED
              : selected
                ? BRAND_RED_SELECTED
                : BRAND_GREEN
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={selected ? 11 : 8}
              pathOptions={{
                color: stroke,
                fillColor: stroke,
                fillOpacity: 0.9,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onSelectStore(s),
              }}
            >
              <Popup>
                <div className="text-sm font-medium text-neutral-900">{s.name}</div>
                <div className="text-xs text-neutral-600 mt-1">
                  {s.address}, {s.city}, {s.state} {s.zip}
                </div>
                <button
                  type="button"
                  className={
                    accent === "red"
                      ? "mt-2 text-xs font-semibold text-[#D10022] underline"
                      : "mt-2 text-xs font-semibold text-blue-600 underline"
                  }
                  onClick={() => onSelectStore(s)}
                >
                  Select for pickup
                </button>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
