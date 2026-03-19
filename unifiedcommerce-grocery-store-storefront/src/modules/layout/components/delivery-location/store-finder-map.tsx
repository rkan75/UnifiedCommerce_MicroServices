"use client"

import type { StoreLocation } from "./store-finder-data"
import { useEffect } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix default marker icons in Leaflet with webpack/Next
const createIcon = (iconUrl: string) =>
  L.icon({
    iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  })

const defaultIcon = createIcon(
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
)
const storeIcon = createIcon(
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png"
)

function FitBounds({ stores, center }: { stores: StoreLocation[]; center: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    const points: [number, number][] = [[center.lat, center.lng]]
    stores.forEach((s) => points.push([s.lat, s.lng]))
    if (points.length === 1) {
      map.setView([center.lat, center.lng], 12)
    } else {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds.pad(0.2))
    }
  }, [map, stores, center])
  return null
}

type StoreFinderMapProps = {
  center: { lat: number; lng: number }
  stores: StoreLocation[]
  className?: string
}

export default function StoreFinderMap({
  center,
  stores,
  className = "",
}: StoreFinderMapProps) {
  return (
    <div className={className} style={{ height: 220 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        scrollWheelZoom={false}
        className="h-full w-full rounded-md z-0"
        style={{ height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds stores={stores} center={center} />
        <Marker
          position={[center.lat, center.lng]}
          icon={defaultIcon}
        >
          <Popup>Your search location</Popup>
        </Marker>
        {stores.map((store) => (
          <Marker
            key={store.id}
            position={[store.lat, store.lng]}
            icon={storeIcon}
          >
            <Popup>
              <strong>{store.name}</strong>
              <br />
              {store.address}, {store.city}, {store.state} {store.zip}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
