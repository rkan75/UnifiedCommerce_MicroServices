import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireRecipeRole } from "../../../utils/require-recipe-role"

type RecipeModule = {
  retrieveRecipe: (id: string) => Promise<{
    id: string
    title: string
    description: string | null
    image_url: string | null
    servings: number | null
    prep_time_minutes: number | null
    cook_time_minutes: number | null
    status: string
  } | null>
  updateRecipes: (data: object | object[]) => Promise<unknown[]>
  deleteRecipes: (ids: string[]) => Promise<void>
  listRecipeSteps: (filters: { recipe_id: string }) => Promise<{ id: string }[]>
  listRecipeIngredients: (filters: { recipe_id: string }) => Promise<{ id: string }[]>
  createRecipeSteps: (data: object | object[]) => Promise<unknown[]>
  createRecipeIngredients: (data: object | object[]) => Promise<unknown[]>
  deleteRecipeSteps: (ids: string[]) => Promise<void>
  deleteRecipeIngredients: (ids: string[]) => Promise<void>
}

/**
 * GET /admin/recipes/:id
 * Get one recipe with steps and ingredients. Allowed: Admin, Content Manager, Product Manager.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!(await requireRecipeRole(req, res))) return
  const { id } = req.params as { id: string }
  const recipeModule = req.scope.resolve("recipe") as RecipeModule

  const recipe = await recipeModule.retrieveRecipe(id)
  if (!recipe) {
    res.status(404).json({ message: "Recipe not found" })
    return
  }

  const [steps, ingredients] = await Promise.all([
    recipeModule.listRecipeSteps({ recipe_id: id }) as Promise<
      Array<{ id: string; step_number: number; instruction: string }>
    >,
    recipeModule.listRecipeIngredients({ recipe_id: id }) as Promise<
      Array<{
        id: string
        product_variant_id: string
        quantity: number
        unit: string | null
        label: string | null
        display_order: number
      }>
    >,
  ])
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number)
  const sortedIngredients = [...ingredients].sort(
    (a, b) => a.display_order - b.display_order
  )

  res.json({
    recipe: {
      ...recipe,
      steps: sortedSteps,
      ingredients: sortedIngredients,
    },
  })
}

/**
 * POST /admin/recipes/:id
 * Update recipe and replace steps/ingredients. Allowed: Admin, Content Manager, Product Manager.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!(await requireRecipeRole(req, res))) return
  const { id } = req.params as { id: string }
  const body = req.body as {
    title?: string
    description?: string | null
    image_url?: string | null
    servings?: number | null
    prep_time_minutes?: number | null
    cook_time_minutes?: number | null
    status?: string
    steps?: Array<{ step_number: number; instruction: string }>
    ingredients?: Array<{
      product_variant_id: string
      quantity: number
      unit?: string | null
      label?: string | null
      display_order: number
    }>
  }
  const recipeModule = req.scope.resolve("recipe") as RecipeModule

  const existing = await recipeModule.retrieveRecipe(id)
  if (!existing) {
    res.status(404).json({ message: "Recipe not found" })
    return
  }

  await recipeModule.updateRecipes({
    id,
    title: body.title ?? existing.title,
    description: body.description !== undefined ? body.description : existing.description,
    image_url: body.image_url !== undefined ? body.image_url : existing.image_url,
    servings: body.servings !== undefined ? body.servings : existing.servings,
    prep_time_minutes:
      body.prep_time_minutes !== undefined
        ? body.prep_time_minutes
        : existing.prep_time_minutes,
    cook_time_minutes:
      body.cook_time_minutes !== undefined
        ? body.cook_time_minutes
        : existing.cook_time_minutes,
    status: body.status ?? existing.status,
  })

  const existingSteps = await recipeModule.listRecipeSteps({ recipe_id: id })
  const existingIngredients = await recipeModule.listRecipeIngredients({
    recipe_id: id,
  })
  if (existingSteps.length > 0) {
    await recipeModule.deleteRecipeSteps(existingSteps.map((s) => s.id))
  }
  if (existingIngredients.length > 0) {
    await recipeModule.deleteRecipeIngredients(existingIngredients.map((i) => i.id))
  }

  const steps = Array.isArray(body.steps) ? body.steps : []
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : []
  if (steps.length > 0) {
    await recipeModule.createRecipeSteps(
      steps.map((s) => ({
        recipe_id: id,
        step_number: s.step_number,
        instruction: s.instruction ?? "",
      }))
    )
  }
  if (ingredients.length > 0) {
    await recipeModule.createRecipeIngredients(
      ingredients.map((i) => ({
        recipe_id: id,
        product_variant_id: i.product_variant_id,
        quantity: Number(i.quantity) || 1,
        unit: i.unit ?? null,
        label: i.label ?? null,
        display_order: Number(i.display_order) ?? 0,
      }))
    )
  }

  res.json({ recipe: { id, ...body } })
}

/**
 * DELETE /admin/recipes/:id
 * Delete recipe (steps and ingredients are cascade-deleted or delete explicitly). Allowed: Admin, Content Manager, Product Manager.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  if (!(await requireRecipeRole(req, res))) return
  const { id } = req.params as { id: string }
  const recipeModule = req.scope.resolve("recipe") as RecipeModule

  const existing = await recipeModule.retrieveRecipe(id)
  if (!existing) {
    res.status(404).json({ message: "Recipe not found" })
    return
  }

  const existingSteps = await recipeModule.listRecipeSteps({ recipe_id: id })
  const existingIngredients = await recipeModule.listRecipeIngredients({
    recipe_id: id,
  })
  if (existingSteps.length > 0) {
    await recipeModule.deleteRecipeSteps(existingSteps.map((s) => s.id))
  }
  if (existingIngredients.length > 0) {
    await recipeModule.deleteRecipeIngredients(existingIngredients.map((i) => i.id))
  }
  await recipeModule.deleteRecipes([id])
  res.status(200).json({ deleted: true, id })
}
