/**
 * Load store locations from CSV into the store_locator module.
 *
 * Usage (from unifiedcommerce-grocery-store directory):
 *   npx medusa exec ./src/scripts/load-store-locations-from-csv.ts
 *   npx medusa exec ./src/scripts/load-store-locations-from-csv.ts -- csv=./data/smart_and_final_stores_50.csv
 *
 * CSV format: store_id,store_name,address,city,state,zip
 * Default CSV path: ./data/smart_and_final_stores_50.csv
 */

import type { ExecArgs } from "@medusajs/framework/types"
import * as fs from "fs"
import * as path from "path"

function parseExecOptions(args: unknown): Record<string, string> {
  if (args && typeof args === "object" && !Array.isArray(args)) return args as Record<string, string>
  const arr = Array.isArray(args) ? args : typeof args === "string" ? args.split(/\s+/) : []
  const out: Record<string, string> = {}
  for (const s of arr) {
    if (typeof s === "string" && s.includes("=")) {
      const [k, ...v] = s.split("=")
      if (k) out[k.trim()] = v.join("=").trim()
    }
  }
  return out
}

function parseCsvPath(args: Record<string, string>): string {
  const csvArg = args?.csv ?? args?.file
  if (csvArg) return path.resolve(process.cwd(), csvArg)
  return path.join(process.cwd(), "data", "smart_and_final_stores_50.csv")
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim())
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    const row: Record<string, string> = {}
    header.forEach((h, j) => {
      row[h] = values[j] ?? ""
    })
    rows.push(row)
  }
  return rows
}

export default async function loadStoreLocationsFromCsv({
  container,
  args,
}: ExecArgs) {
  const options = parseExecOptions(args ?? [])
  const storeLocatorModule = container.resolve("storeLocator") as {
    createStoreLocations: (data: Array<{
      name: string
      address_1: string
      city: string | null
      state: string | null
      zip: string | null
      country_code: string
      lat?: number | null
      lng?: number | null
      opening_hours?: string | null
      phone?: string | null
    }>) => Promise<unknown[]>
    listStoreLocations: (filters?: object) => Promise<unknown[]>
  }

  const csvPath = parseCsvPath(options)
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`)
    console.error("Place smart_and_final_stores_50.csv in ./data/ or pass csv=./path/to/file.csv")
    process.exit(1)
  }

  const content = fs.readFileSync(csvPath, "utf-8")
  const rows = parseCsv(content)
  if (rows.length === 0) {
    console.error("No data rows in CSV.")
    process.exit(1)
  }

  const locations = rows.map((row) => ({
    name: row.store_name ?? row.name ?? "",
    address_1: row.address ?? row.address_1 ?? "",
    city: row.city ?? null,
    state: row.state ?? null,
    zip: row.zip ?? null,
    country_code: "US",
    lat: null as number | null,
    lng: null as number | null,
    opening_hours: null as string | null,
    phone: null as string | null,
  }))

  const created = await storeLocatorModule.createStoreLocations(locations)
  console.log(`Loaded ${created.length} store locations from ${csvPath}`)
  return created
}
