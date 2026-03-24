import { model } from "@medusajs/framework/utils"

const RecipeStep = model
  .define("recipe_step", {
    id: model.id({ prefix: "rcst" }).primaryKey(),
    recipe: model.belongsTo(() => require("./recipe").default, {
      mappedBy: "steps",
    }),
    step_number: model.number(),
    instruction: model.text(),
  })
  .indexes([
    {
      on: ["recipe_id"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["recipe_id", "step_number"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default RecipeStep
