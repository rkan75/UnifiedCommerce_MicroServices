import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getRecipeById } from "@lib/data/recipes"
import RecipeDetailTemplate from "@modules/recipes/templates/recipe-detail"

type Props = {
  params: Promise<{ countryCode: string; id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const data = await getRecipeById(params.id)
  if (!data?.recipe) return { title: "Recipe" }
  return {
    title: `${data.recipe.title} | Recipes`,
    description: data.recipe.description,
  }
}

export default async function RecipeDetailPage(props: Props) {
  const params = await props.params
  const { countryCode, id } = params

  const data = await getRecipeById(id)
  if (!data?.recipe) notFound()

  return (
    <RecipeDetailTemplate
      recipe={data.recipe}
      countryCode={countryCode}
    />
  )
}
