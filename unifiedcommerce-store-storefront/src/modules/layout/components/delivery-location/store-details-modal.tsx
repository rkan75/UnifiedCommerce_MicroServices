"use client"

import { formatStoreDistanceMilesDetail } from "@lib/config/store-locator"
import { XMark } from "@medusajs/icons"
import type { ReactNode } from "react"
import type { StoreLocation } from "./store-finder-data"

type StoreDetailsModalProps = {
  store: StoreLocation | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm border-b border-neutral-100 py-2 last:border-0">
      <dt className="font-medium text-neutral-500 shrink-0">{label}</dt>
      <dd className="text-neutral-900 break-words">{value}</dd>
    </div>
  )
}

export default function StoreDetailsModal({ store, onClose }: StoreDetailsModalProps) {
  if (!store) return null

  const meta = store.metadata
  const hasMeta = meta && typeof meta === "object" && Object.keys(meta).length > 0

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center small:items-center p-0 small:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-details-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[81] w-full max-w-[440px] max-h-[85vh] overflow-hidden flex flex-col rounded-t-lg small:rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 shrink-0">
          <h2 id="store-details-title" className="text-base font-bold text-neutral-900 pr-2">
            Store details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-neutral-100 text-neutral-600"
            aria-label="Close store details"
          >
            <XMark className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">
          <dl className="flex flex-col">
            <Row label="Store ID" value={store.id} />
            <Row label="Name" value={store.name} />
            <Row label="Address" value={store.address} />
            <Row label="City" value={store.city} />
            <Row label="State" value={store.state} />
            <Row label="ZIP" value={store.zip} />
            <Row label="Country" value={store.countryCode} />
            <Row label="Phone" value={store.phone} />
            <Row label="Hours" value={store.openingHours} />
            <Row
              label="Latitude"
              value={Number.isFinite(store.lat) ? String(store.lat) : null}
            />
            <Row
              label="Longitude"
              value={Number.isFinite(store.lng) ? String(store.lng) : null}
            />
            <Row label="Distance" value={formatStoreDistanceMilesDetail(store.distanceMiles)} />
          </dl>
          {hasMeta && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                Metadata
              </p>
              <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-3 overflow-x-auto text-neutral-800 whitespace-pre-wrap break-words">
                {JSON.stringify(meta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
