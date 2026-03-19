import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type RecipeModule = {
  listRecipes: (filters: { status?: string }, config?: { relations?: string[] }) => Promise<
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
}

/**
 * GET /store/recipes
 * Returns published recipes (no steps/ingredients) for list page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const recipeModule = req.scope.resolve("recipe") as RecipeModule
  const recipes = await recipeModule.listRecipes(
    { status: "published" },
    { relations: [] }
  )
  const payload = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    image_url: r.image_url,
    servings: r.servings ?? 0,
    prep_time_minutes: r.prep_time_minutes ?? 0,
    cook_time_minutes: r.cook_time_minutes ?? 0,
  }))
  res.json({ recipes: payload })
}
