import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type StoreLocatorModule = {
  listStoreLocations: (filters?: Record<string, unknown>, config?: { relations?: string[] }) => Promise<
    Array<{
      id: string
      name: string
      address_1: string
      city: string | null
      state: string | null
      zip: string | null
      country_code: string | null
      lat: number | null
      lng: number | null
      opening_hours: string | null
      phone: string | null
      metadata: Record<string, unknown> | null
    }>
  >
}

/**
 * GET /store/store-locations
 * Returns all store locations for the store locator / checkout flow.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const storeLocatorModule = req.scope.resolve("storeLocator") as StoreLocatorModule
  const locations = await storeLocatorModule.listStoreLocations(
    {},
    { relations: [] }
  )
  const payload = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    address: loc.address_1,
    address_1: loc.address_1,
    city: loc.city ?? "",
    state: loc.state ?? "",
    zip: loc.zip ?? "",
    country_code: loc.country_code ?? "US",
    lat: loc.lat,
    lng: loc.lng,
    opening_hours: loc.opening_hours ?? null,
    phone: loc.phone ?? null,
    metadata: loc.metadata ?? null,
  }))
  res.json({ store_locations: payload })
}
