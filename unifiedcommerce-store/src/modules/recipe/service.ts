import { MedusaService } from "@medusajs/framework/utils"
import { Recipe, RecipeStep, RecipeIngredient } from "./models"

class RecipeModuleService extends MedusaService({
  Recipe,
  RecipeStep,
  RecipeIngredient,
}) {}

export default RecipeModuleService
