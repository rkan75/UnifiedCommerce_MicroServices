import { Metadata } from "next"
import { listRecipes } from "@lib/data/recipes"
import RecipesListTemplate from "@modules/recipes/templates/recipes-list"

export const metadata: Metadata = {
  title: "Recipes",
  description: "Browse recipes from our grocery store.",
}

type Props = {
  params: Promise<{ countryCode: string }>
}

export default async function RecipesPage(props: Props) {
  const params = await props.params
  const recipes = await listRecipes()

  return (
    <RecipesListTemplate
      recipes={recipes}
      countryCode={params.countryCode}
    />
  )
}
