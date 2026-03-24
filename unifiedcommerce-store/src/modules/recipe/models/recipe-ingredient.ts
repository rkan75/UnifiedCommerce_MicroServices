import { model } from "@medusajs/framework/utils"

const RecipeIngredient = model
  .define("recipe_ingredient", {
    id: model.id({ prefix: "rcing" }).primaryKey(),
    recipe: model.belongsTo(() => require("./recipe").default, {
      mappedBy: "ingredients",
    }),
    product_variant_id: model.text(), // Medusa Product Variant ID for cart line items
    quantity: model.number(),
    unit: model.text().nullable(),
    label: model.text().nullable(), // e.g. "2 cups flour, sifted"
    display_order: model.number(),
  })
  .indexes([
    {
      on: ["recipe_id"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["recipe_id", "product_variant_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default RecipeIngredient
