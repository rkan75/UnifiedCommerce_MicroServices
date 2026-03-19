"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { StoreRecipeListItem } from "@lib/data/recipes"

type RecipesListTemplateProps = {
  recipes: StoreRecipeListItem[]
  countryCode: string
}

export default function RecipesListTemplate({
  recipes,
  countryCode,
}: RecipesListTemplateProps) {
  return (
    <div className="content-container py-6 md:py-10">
      <h1 className="text-2xl md:text-3xl font-semibold text-ui-fg-base mb-6">
        Recipes
      </h1>

      <p className="text-ui-fg-muted txt-small mb-6">
        {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
      </p>

      <ul className="grid grid-cols-1 small:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <LocalizedClientLink href={`/recipes/${recipe.id}`}>
              <article className="flex flex-col h-full rounded-lg border border-ui-border-base bg-ui-bg-base overflow-hidden hover:border-ui-border-strong hover:shadow-md transition-all">
                <div
                  className="aspect-[4/3] bg-ui-bg-subtle flex items-center justify-center text-ui-fg-muted txt-small overflow-hidden"
                  aria-hidden
                >
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>Recipe</span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h2 className="text-base font-semibold text-ui-fg-base line-clamp-2">
                    {recipe.title}
                  </h2>
                  <div className="mt-2 flex gap-3 txt-small text-ui-fg-muted">
                    <span>Prep {recipe.prep_time_minutes}m</span>
                    <span>Cook {recipe.cook_time_minutes}m</span>
                    <span>{recipe.servings} servings</span>
                  </div>
                </div>
              </article>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>

      {recipes.length === 0 && (
        <p className="text-ui-fg-muted txt-small py-8">
          No recipes yet.
        </p>
      )}
    </div>
  )
}
