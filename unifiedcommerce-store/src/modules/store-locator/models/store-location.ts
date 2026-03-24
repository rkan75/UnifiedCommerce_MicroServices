import { model } from "@medusajs/framework/utils"

const StoreLocation = model
  .define("store_location", {
    id: model.id({ prefix: "stloc" }).primaryKey(),
    name: model.text().searchable(),
    address_1: model.text(),
    city: model.text().nullable(),
    state: model.text().nullable(),
    zip: model.text().nullable(),
    country_code: model.text().nullable(),
    lat: model.number().nullable(),
    lng: model.number().nullable(),
    opening_hours: model.text().nullable(),
    phone: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ["deleted_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default StoreLocation
