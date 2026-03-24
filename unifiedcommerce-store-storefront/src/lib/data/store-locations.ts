"use server"

import { sdk } from "@lib/config"

export type StoreLocationApi = {
  id: string
  name: string
  address: string
  address_1: string
  city: string
  state: string
  zip: string
  country_code: string
  lat: number | null
  lng: number | null
  opening_hours: string | null
  phone: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Fetches all store locations from the backend (store locator module).
 * Used by the delivery flow to show nearest stores within radius of delivery address.
 */
export async function getStoreLocations(): Promise<StoreLocationApi[]> {
  try {
    const res = await sdk.client.fetch<{ store_locations: StoreLocationApi[] }>(
      "/store/store-locations",
      { method: "GET", cache: "no-store" }
    )
    return res.store_locations ?? []
  } catch {
    return []
  }
}
