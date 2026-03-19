"use client"

import { MapPin } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { useParams } from "next/navigation"
import { useState } from "react"
import UpdateLocationPanel from "./update-location-panel"

type DeliveringToProps = {
  initialZip: string | null
  countryCode: string
  customer: HttpTypes.StoreCustomer | null
}

export default function DeliveringTo({
  initialZip,
  countryCode,
  customer,
}: DeliveringToProps) {
  const params = useParams()
  const resolvedCountryCode = (params?.countryCode as string) || countryCode
  const [panelOpen, setPanelOpen] = useState(false)

  const displayZip = initialZip || "—"

  return (
    <>
      <div
        className={clx(
          "flex flex-col shrink-0 max-w-[120px] xsmall:max-w-[160px] tablet:max-w-[200px] small:max-w-none hidden xsmall:flex",
          "text-xs xsmall:text-sm font-medium text-ui-button-neutral-text"
        )}
      >
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">
            Delivering to{" "}
            <span className="font-medium">{displayZip}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="text-left text-sm font-medium text-ui-button-neutral-text hover:opacity-80 mt-0.5 transition-opacity"
          aria-label="Update delivery or pickup location"
          data-testid="update-location-link"
        >
          Update Location
        </button>
      </div>

      <UpdateLocationPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        countryCode={resolvedCountryCode}
        customer={customer}
      />
    </>
  )
}
