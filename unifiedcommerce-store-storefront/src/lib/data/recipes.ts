"use server"

import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type StoreRecipeListItem = {
  id: string
  title: string
  description: string
  image_url: string | null
  servings: number
  prep_time_minutes: number
  cook_time_minutes: number
}

export type StoreRecipeStep = {
  step_number: number
  instruction: string
}

export type StoreRecipeIngredient = {
  product_variant_id: string
  quantity: number
  unit: string | null
  label: string | null
  display_order: number
}

export type StoreRecipeDetail = StoreRecipeListItem & {
  steps: StoreRecipeStep[]
  ingredients: StoreRecipeIngredient[]
}

export async function listRecipes(): Promise<StoreRecipeListItem[]> {
  const next = await getCacheOptions("recipes")
  const data = await sdk.client.fetch<{ recipes: StoreRecipeListItem[] }>(
    "/store/recipes",
    {
      method: "GET",
      next,
      cache: "force-cache",
    }
  )
  return data.recipes ?? []
}

export async function getRecipeById(
  id: string
): Promise<{ recipe: StoreRecipeDetail } | null> {
  const next = await getCacheOptions("recipes")
  const data = await sdk.client
    .fetch<{ recipe: StoreRecipeDetail }>(`/store/recipes/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .catch(() => null)
  if (!data?.recipe) return data
  // Ensure quantity is a number (API/JSON may return string)
  data.recipe.ingredients = (data.recipe.ingredients ?? []).map((ing) => ({
    ...ing,
    quantity: Number(ing.quantity) || 1,
  }))
  return data
}
