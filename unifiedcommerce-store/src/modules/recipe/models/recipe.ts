import { model } from "@medusajs/framework/utils"
import RecipeStep from "./recipe-step"
import RecipeIngredient from "./recipe-ingredient"

const Recipe = model
  .define("recipe", {
    id: model.id({ prefix: "recipe" }).primaryKey(),
    title: model.text().searchable(),
    description: model.text().nullable(),
    image_url: model.text().nullable(),
    servings: model.number().nullable(),
    prep_time_minutes: model.number().nullable(),
    cook_time_minutes: model.number().nullable(),
    status: model.text().searchable(), // "draft" | "published"
    metadata: model.json().nullable(),
    steps: model.hasMany(() => RecipeStep, {
      mappedBy: "recipe",
    }),
    ingredients: model.hasMany(() => RecipeIngredient, {
      mappedBy: "recipe",
    }),
  })
  .indexes([
    {
      on: ["status"],
      where: "deleted_at IS NULL",
    },
  ])

export default Recipe
