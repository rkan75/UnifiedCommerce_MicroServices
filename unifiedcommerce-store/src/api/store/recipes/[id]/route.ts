import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type RecipeModule = {
  retrieveRecipe: (id: string, config?: { relations?: string[] }) => Promise<{
    id: string
    title: string
    description: string | null
    image_url: string | null
    servings: number | null
    prep_time_minutes: number | null
    cook_time_minutes: number | null
    status: string
    steps?: Array<{ step_number: number; instruction: string }>
    ingredients?: Array<{
      product_variant_id: string
      quantity: number
      unit: string | null
      label: string | null
      display_order: number
    }>
  } | null>
  listRecipeSteps: (filters: { recipe_id: string }) => Promise<
    Array<{ step_number: number; instruction: string }>
  >
  listRecipeIngredients: (filters: { recipe_id: string }) => Promise<
    Array<{
      product_variant_id: string
      quantity: number
      unit: string | null
      label: string | null
      display_order: number
    }>
  >
}

/**
 * GET /store/recipes/:id
 * Returns one published recipe with steps and ingredients for detail page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params as { id: string }
  const recipeModule = req.scope.resolve("recipe") as RecipeModule

  let recipe: Awaited<ReturnType<RecipeModule["retrieveRecipe"]>>
  try {
    recipe = await recipeModule.retrieveRecipe(id)
  } catch {
    res.status(404).json({ message: "Recipe not found" })
    return
  }

  if (!recipe || recipe.status !== "published") {
    res.status(404).json({ message: "Recipe not found" })
    return
  }

  const [steps, ingredients] = await Promise.all([
    recipeModule.listRecipeSteps({ recipe_id: id }),
    recipeModule.listRecipeIngredients({ recipe_id: id }),
  ])

  steps.sort((a, b) => a.step_number - b.step_number)
  ingredients.sort((a, b) => a.display_order - b.display_order)

  res.json({
    recipe: {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description ?? "",
      image_url: recipe.image_url,
      servings: recipe.servings ?? 0,
      prep_time_minutes: recipe.prep_time_minutes ?? 0,
      cook_time_minutes: recipe.cook_time_minutes ?? 0,
      steps,
      ingredients,
    },
  })
}
