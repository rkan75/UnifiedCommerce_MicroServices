import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireRecipeRole } from "../../utils/require-recipe-role"

type RecipeModule = {
  listRecipes: (filters?: object, config?: { take?: number }) => Promise<
    Array<{
      id: string
      title: string
      description: string | null
      image_url: string | null
      servings: number | null
      prep_time_minutes: number | null
      cook_time_minutes: number | null
      status: string
    }>
  >
  createRecipes: (data: object | object[]) => Promise<{ id: string }[]>
  createRecipeSteps: (data: object | object[]) => Promise<unknown[]>
  createRecipeIngredients: (data: object | object[]) => Promise<unknown[]>
}

/**
 * GET /admin/recipes
 * List all recipes (any status). Allowed: Admin, Content Manager, Product Manager.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!(await requireRecipeRole(req, res))) return
  const recipeModule = req.scope.resolve("recipe") as RecipeModule
  const recipes = await recipeModule.listRecipes({}, { take: 500 })
  res.json({ recipes })
}

/**
 * POST /admin/recipes
 * Create a recipe with steps and ingredients. Allowed: Admin, Content Manager, Product Manager.
 * Body: { title, description?, image_url?, servings?, prep_time_minutes?, cook_time_minutes?, status?, steps: [{ step_number, instruction }], ingredients: [{ product_variant_id, quantity, unit?, label?, display_order }] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!(await requireRecipeRole(req, res))) return
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

  try {
    const recipeModule = req.scope.resolve("recipe") as RecipeModule

    const createdList = await recipeModule.createRecipes([
      {
        title: body.title ?? "",
        description: body.description ?? null,
        image_url: body.image_url ?? null,
        servings: body.servings ?? null,
        prep_time_minutes: body.prep_time_minutes ?? null,
        cook_time_minutes: body.cook_time_minutes ?? null,
        status: body.status === "published" ? "published" : "draft",
        metadata: null,
      },
    ])
    const created = Array.isArray(createdList) ? createdList[0] : createdList
    if (!created || typeof (created as { id?: string }).id !== "string") {
      return res.status(500).json({
        message: "Recipe creation failed: no recipe returned from database.",
      })
    }
    const recipeId = (created as { id: string }).id

    const steps = Array.isArray(body.steps) ? body.steps : []
    if (steps.length > 0) {
      await recipeModule.createRecipeSteps(
        steps.map((s) => ({
          recipe_id: recipeId,
          step_number: Number(s.step_number) ?? 0,
          instruction: typeof s.instruction === "string" ? s.instruction : "",
        }))
      )
    }

    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : []
    if (ingredients.length > 0) {
      await recipeModule.createRecipeIngredients(
        ingredients.map((i) => ({
          recipe_id: recipeId,
          product_variant_id: String(i.product_variant_id ?? ""),
          quantity: Number(i.quantity) || 1,
          unit: i.unit ?? null,
          label: i.label ?? null,
          display_order: Number(i.display_order) ?? 0,
        }))
      )
    }

    return res.status(201).json({ recipe: { id: recipeId, ...body } })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Recipe creation failed."
    return res.status(500).json({ message })
  }
}
