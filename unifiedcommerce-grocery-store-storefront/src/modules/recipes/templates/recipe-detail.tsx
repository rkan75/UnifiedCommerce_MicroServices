"use client"

import { ShoppingCart } from "@medusajs/icons"
import { Button, Heading, Text, toast } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { addToCart } from "@lib/data/cart"
import type { StoreRecipeDetail } from "@lib/data/recipes"

type RecipeDetailTemplateProps = {
  recipe: StoreRecipeDetail
  countryCode: string
}

function ingredientLabel(ing: StoreRecipeDetail["ingredients"][0]): string {
  if (ing.label) return ing.label
  const q = String(ing.quantity)
  const u = ing.unit ? ` ${ing.unit}` : ""
  return `${q}${u}`.trim() || "—"
}

export default function RecipeDetailTemplate({
  recipe,
  countryCode,
}: RecipeDetailTemplateProps) {
  const router = useRouter()
  const [addingToCart, setAddingToCart] = useState<Record<string, boolean>>({})
  const [addingAllToCart, setAddingAllToCart] = useState(false)

  const handleAddToCart = async (variantId: string, quantity: number) => {
    const qty = Math.max(1, Math.round(Number(quantity)) || 1)
    if (!variantId?.trim()) {
      toast.error("Cannot add to cart: missing product variant.")
      return
    }
    setAddingToCart((prev) => ({ ...prev, [variantId]: true }))
    try {
      await addToCart({
        variantId: variantId.trim(),
        quantity: qty,
        countryCode,
      })
      toast.success("Added to cart")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add to cart"
      console.error("Add to cart failed:", error)
      toast.error(message)
      router.refresh()
    } finally {
      setAddingToCart((prev) => ({ ...prev, [variantId]: false }))
    }
  }

  const directions = (recipe.steps ?? [])
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => s.instruction)

  const ingredients = (recipe.ingredients ?? []).sort(
    (a, b) => a.display_order - b.display_order
  )

  const handleAddAllToCart = async () => {
    if (ingredients.length === 0) return
    setAddingAllToCart(true)
    try {
      for (const ing of ingredients) {
        const variantId = ing.product_variant_id?.trim()
        if (!variantId) continue
        const qty = Math.max(1, Math.round(Number(ing.quantity)) || 1)
        await addToCart({
          variantId,
          quantity: qty,
          countryCode,
        })
      }
      toast.success("All ingredients added to cart")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add ingredients to cart"
      console.error("Add all to cart failed:", error)
      toast.error(message)
      router.refresh()
    } finally {
      setAddingAllToCart(false)
    }
  }

  return (
    <div className="content-container py-8 md:py-12">
      <nav className="mb-6 txt-small text-ui-fg-muted" aria-label="Breadcrumb">
        <LocalizedClientLink href="/recipes" className="hover:text-ui-fg-base">
          Recipes
        </LocalizedClientLink>
        <span className="mx-2">/</span>
        <span className="text-ui-fg-base">{recipe.title}</span>
      </nav>

      <header className="mb-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {recipe.image_url && (
            <div className="shrink-0 w-full md:w-80 lg:w-96 aspect-[4/3] rounded-lg overflow-hidden border border-ui-border-base bg-ui-bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            <Heading level="h1" className="text-2xl md:text-4xl font-bold text-ui-fg-base">
              {recipe.title}
            </Heading>
            <Text className="mt-2 text-ui-fg-subtle max-w-2xl">
              {recipe.description}
            </Text>
            <div className="mt-4 flex flex-wrap gap-4 txt-small text-ui-fg-muted">
              <span>Prep Time {recipe.prep_time_minutes} min</span>
              <span>Cook Time {recipe.cook_time_minutes} min</span>
              <span>Servings {recipe.servings}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <section className="lg:col-span-1" aria-labelledby="ingredients-heading">
          <Heading
            id="ingredients-heading"
            level="h2"
            className="text-xl font-semibold text-ui-fg-base mb-4"
          >
            Ingredients
          </Heading>
          <ul className="space-y-4">
            {ingredients.map((ing, idx) => (
              <li
                key={`${ing.product_variant_id}-${idx}`}
                className="flex flex-col gap-2 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle"
              >
                <span className="txt-small-plus text-ui-fg-base">
                  {ingredientLabel(ing)}
                </span>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={addingToCart[ing.product_variant_id]}
                  isLoading={addingToCart[ing.product_variant_id]}
                  onClick={() =>
                    handleAddToCart(
                      ing.product_variant_id,
                      Number(ing.quantity) || 1
                    )
                  }
                  className="shrink-0 gap-1.5 w-fit"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button
              variant="secondary"
              className="w-full gap-1.5"
              disabled={addingAllToCart || ingredients.length === 0}
              isLoading={addingAllToCart}
              onClick={handleAddAllToCart}
            >
              <ShoppingCart className="w-4 h-4" />
              Shop All Ingredients
            </Button>
          </div>
        </section>

        <section
          className="lg:col-span-2"
          aria-labelledby="directions-heading"
        >
          <Heading
            id="directions-heading"
            level="h2"
            className="text-xl font-semibold text-ui-fg-base mb-4"
          >
            Directions
          </Heading>
          <ol className="list-decimal list-inside space-y-3 text-ui-fg-base txt-small-plus">
            {directions.map((step, i) => (
              <li key={i} className="pl-2">
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-10 pt-8 border-t border-ui-border-base">
        <LocalizedClientLink href="/recipes">
          <span className="text-ui-fg-interactive hover:underline txt-small-plus font-medium">
            ← Back to all recipes
          </span>
        </LocalizedClientLink>
      </div>
    </div>
  )
}
