"use client"

import dynamic from "next/dynamic"
import type { StoreLocation } from "@modules/layout/components/delivery-location/store-finder-data"

const PickupStoresMapInner = dynamic(
  () => import("./pickup-stores-map-inner"),
  { ssr: false, loading: () => <div className="h-[min(280px,50vh)] w-full animate-pulse rounded-lg bg-ui-bg-subtle" /> }
)

type Props = {
  stores: StoreLocation[]
  selectedId: string | null
  onSelectStore: (store: StoreLocation) => void
  /** Match store locator page (`red`) vs embedded checkout (`green`). */
  accent?: "red" | "green"
}

export default function PickupStoresMap(props: Props) {
  return <PickupStoresMapInner {...props} />
}
