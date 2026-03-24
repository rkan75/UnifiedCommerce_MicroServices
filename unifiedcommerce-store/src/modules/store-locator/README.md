# Store Locator Module

Custom Medusa module for physical store locations (store finder).

## Tables

- **store_location**: `id`, `name`, `address_1`, `city`, `state`, `zip`, `country_code`, `lat`, `lng`, `opening_hours`, `phone`, `metadata`, `created_at`, `updated_at`, `deleted_at`

## Migrations

From project root:

```bash
npx medusa db:migrate
```

## Load data from CSV

CSV format: `store_id`, `store_name`, `address`, `city`, `state`, `zip`

Default file: `data/smart_and_final_stores_50.csv`

```bash
npx medusa exec ./src/scripts/load-store-locations-from-csv.ts
# Or with custom path:
npx medusa exec ./src/scripts/load-store-locations-from-csv.ts -- csv=./path/to/stores.csv
```

## Store API

- **GET /store/store-locations** – returns all store locations for the storefront (store locator / checkout flow).

## Module key

Resolve in routes or scripts: `container.resolve("storeLocator")`

Service methods: `createStoreLocations`, `listStoreLocations`, `updateStoreLocations`, `deleteStoreLocations`, `retrieveStoreLocation`, etc.
