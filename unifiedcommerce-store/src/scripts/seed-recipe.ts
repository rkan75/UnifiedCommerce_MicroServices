/**
 * Seed script for recipe, recipe_step, and recipe_ingredient tables.
 * Run: npx medusa exec ./src/scripts/seed-recipe.ts
 *
 * Creates 6 recipes with image URLs. Uses existing product variants for
 * ingredients when available. If no products exist, run the main seed first.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateEntityId } from "@medusajs/utils"

type RecipeModule = {
  createRecipes: (data: object | object[]) => Promise<unknown[]>
  createRecipeSteps: (data: object | object[]) => Promise<unknown[]>
  createRecipeIngredients: (data: object | object[]) => Promise<unknown[]>
}

// Unique image URL per recipe (800x600, deterministic per seed)
const recipeImage = (seed: string) =>
  `https://picsum.photos/seed/${seed}/800/600`

export default async function seedRecipe({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (msg: string) => void
    warn: (msg: string) => void
  }

  let recipeModule: RecipeModule
  try {
    recipeModule = container.resolve("recipe") as RecipeModule
  } catch (e) {
    logger.warn("Recipe module not found. Ensure it is registered in medusa-config.ts.")
    return
  }

  const productModule = container.resolve(Modules.PRODUCT) as {
    listProductVariants: (filters?: object, config?: { take?: number }) => Promise<{ id: string }[]>
  }

  logger.info("Seeding recipe data...")

  let variantIds: string[] = []
  try {
    const variants = await productModule.listProductVariants({}, { take: 24 })
    variantIds = variants.map((v) => v.id)
  } catch {
    // ignore
  }
  if (variantIds.length === 0) {
    logger.warn("No product variants found. Recipe ingredients will use placeholder variant IDs. Run main seed first or add products.")
    variantIds = Array.from({ length: 12 }, (_, i) => `variant_placeholder_${i + 1}`)
  }

  const getVariant = (i: number) => variantIds[i % variantIds.length]!

  const recipeIds = Array.from({ length: 6 }, () => generateEntityId(undefined, "recipe"))

  const recipes = [
    {
      id: recipeIds[0],
      title: "Classic Greek Salad",
      description: "Fresh Mediterranean salad with cucumber, tomato, feta, and olive oil.",
      image_url: "https://m.media-amazon.com/images/I/81D+B+s2NQL._FMwebp_.jpg",
      servings: 4,
      prep_time_minutes: 15,
      cook_time_minutes: 0,
      status: "published",
      metadata: { cuisine: "mediterranean", difficulty: "easy" },
    },
    {
      id: recipeIds[1],
      title: "Berry Smoothie Bowl",
      description: "Creamy smoothie bowl topped with fresh berries and granola.",
      image_url: "https://www.kroger.com/content/v2/binary/recipe/images/5b21668d84aeb83e5f7524d7-original.jpg",
      servings: 2,
      prep_time_minutes: 10,
      cook_time_minutes: 0,
      status: "published",
      metadata: { cuisine: "breakfast", difficulty: "easy" },
    },
    {
      id: recipeIds[2],
      title: "Creamy Tomato Basil Pasta",
      description: "Simple pasta with a rich tomato and basil cream sauce.",
      image_url: "https://www.kroger.com/content/v2/binary/image/recipes/imageset_spicy-creamy-tomato-pasta--7_spicy-creamy-tomato-pasta_p12-rd-and-photo_r_23-tkc-0159_b.jpg",
      servings: 4,
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      status: "published",
      metadata: { cuisine: "italian", difficulty: "easy" },
    },
    {
      id: recipeIds[3],
      title: "Vegetable Minestrone Soup",
      description: "Hearty Italian soup with beans, vegetables, and pasta.",
      image_url: "data:image/webp;base64,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",
      servings: 6,
      prep_time_minutes: 20,
      cook_time_minutes: 35,
      status: "published",
      metadata: { cuisine: "italian", difficulty: "medium" },
    },
    {
      id: recipeIds[4],
      title: "Avocado Toast with Eggs",
      description: "Toasted bread topped with mashed avocado and poached eggs.",
      image_url: "data:image/webp;base64,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",
      servings: 2,
      prep_time_minutes: 5,
      cook_time_minutes: 10,
      status: "published",
      metadata: { cuisine: "breakfast", difficulty: "easy" },
    },
    {
      id: recipeIds[5],
      title: "Honey Garlic Stir-Fry Vegetables",
      description: "Crisp vegetables in a sweet and savory honey garlic sauce.",
      image_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXDwwwGZF-J01d-3OhaAg6j-eOrUFm1EdHdCl2xNRqVTtlZkKCjlYdoO7fXEFoYEH2TYcv3DDzqnKEPPOseGFPCajQZAMcoBGXEj3-XjeXow&usqp=CAE&s&ec=121528435",
      servings: 4,
      prep_time_minutes: 15,
      cook_time_minutes: 12,
      status: "published",
      metadata: { cuisine: "asian", difficulty: "easy" },
    },
  ]

  const allSteps: { id: string; recipe_id: string; step_number: number; instruction: string }[] = []
  const allIngredients: { id: string; recipe_id: string; product_variant_id: string; quantity: number; unit: string | null; label: string | null; display_order: number }[] = []

  // Recipe 1: Greek Salad
  allSteps.push(
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[0], step_number: 1, instruction: "Chop cucumbers, tomatoes, and red onion into bite-sized pieces." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[0], step_number: 2, instruction: "Add olives and cubed feta cheese." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[0], step_number: 3, instruction: "Drizzle with olive oil and lemon juice. Season with salt, pepper, and oregano. Toss and serve." }
  )
  allIngredients.push(
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[0], product_variant_id: getVariant(0), quantity: 2, unit: "pieces", label: "2 cucumbers, diced", display_order: 1 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[0], product_variant_id: getVariant(1), quantity: 4, unit: "pieces", label: "4 ripe tomatoes", display_order: 2 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[0], product_variant_id: getVariant(2), quantity: 1, unit: "cup", label: "1 cup feta cheese, cubed", display_order: 3 }
  )

  // Recipe 2: Berry Smoothie Bowl
  allSteps.push(
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[1], step_number: 1, instruction: "Blend frozen berries, banana, and yogurt until smooth." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[1], step_number: 2, instruction: "Pour into bowls and top with fresh berries, granola, and a drizzle of honey." }
  )
  allIngredients.push(
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[1], product_variant_id: getVariant(3), quantity: 2, unit: "cups", label: "2 cups mixed berries", display_order: 1 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[1], product_variant_id: getVariant(4), quantity: 1, unit: "cup", label: "1 cup yogurt", display_order: 2 }
  )

  // Recipe 3: Tomato Basil Pasta
  allSteps.push(
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[2], step_number: 1, instruction: "Cook pasta according to package directions. Drain and reserve 1/2 cup pasta water." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[2], step_number: 2, instruction: "Sauté garlic in olive oil, add crushed tomatoes and cream. Simmer 10 minutes." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[2], step_number: 3, instruction: "Toss pasta with sauce, torn basil, and Parmesan. Add pasta water if needed." }
  )
  allIngredients.push(
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[2], product_variant_id: getVariant(5), quantity: 1, unit: "lb", label: "1 lb pasta", display_order: 1 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[2], product_variant_id: getVariant(6), quantity: 2, unit: "cups", label: "2 cups crushed tomatoes", display_order: 2 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[2], product_variant_id: getVariant(7), quantity: 1, unit: "cup", label: "1 cup fresh basil", display_order: 3 }
  )

  // Recipe 4: Minestrone
  allSteps.push(
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[3], step_number: 1, instruction: "Sauté onion, carrot, and celery in olive oil until softened." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[3], step_number: 2, instruction: "Add vegetable broth, diced tomatoes, beans, and pasta. Bring to a boil." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[3], step_number: 3, instruction: "Simmer 20 minutes until pasta is tender. Stir in spinach and season. Serve with Parmesan." }
  )
  allIngredients.push(
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[3], product_variant_id: getVariant(8), quantity: 6, unit: "cups", label: "6 cups vegetable broth", display_order: 1 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[3], product_variant_id: getVariant(9), quantity: 2, unit: "cans", label: "2 cans cannellini beans", display_order: 2 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[3], product_variant_id: getVariant(10), quantity: 1, unit: "cup", label: "1 cup small pasta", display_order: 3 }
  )

  // Recipe 5: Avocado Toast
  allSteps.push(
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[4], step_number: 1, instruction: "Toast bread until golden. Mash avocado with lime juice, salt, and pepper." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[4], step_number: 2, instruction: "Poach eggs. Spread avocado on toast, top with eggs and optional red pepper flakes." }
  )
  allIngredients.push(
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[4], product_variant_id: getVariant(11), quantity: 2, unit: "slices", label: "2 slices sourdough bread", display_order: 1 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[4], product_variant_id: getVariant(0), quantity: 1, unit: "pieces", label: "1 ripe avocado", display_order: 2 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[4], product_variant_id: getVariant(1), quantity: 2, unit: "pieces", label: "2 eggs", display_order: 3 }
  )

  // Recipe 6: Honey Garlic Stir-Fry
  allSteps.push(
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[5], step_number: 1, instruction: "Whisk soy sauce, honey, garlic, and ginger in a small bowl." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[5], step_number: 2, instruction: "Stir-fry broccoli, bell pepper, and snap peas in a hot wok with oil for 4–5 minutes." },
    { id: generateEntityId(undefined, "rcst"), recipe_id: recipeIds[5], step_number: 3, instruction: "Add sauce and toss until vegetables are coated and glossy. Serve over rice if desired." }
  )
  allIngredients.push(
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[5], product_variant_id: getVariant(2), quantity: 3, unit: "tbsp", label: "3 tbsp honey", display_order: 1 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[5], product_variant_id: getVariant(3), quantity: 2, unit: "cups", label: "2 cups mixed stir-fry vegetables", display_order: 2 },
    { id: generateEntityId(undefined, "rcing"), recipe_id: recipeIds[5], product_variant_id: getVariant(4), quantity: 2, unit: "tbsp", label: "2 tbsp soy sauce", display_order: 3 }
  )

  await recipeModule.createRecipes(recipes)
  logger.info(`Created ${recipes.length} recipes.`)

  await recipeModule.createRecipeSteps(allSteps)
  logger.info(`Created ${allSteps.length} recipe steps.`)

  await recipeModule.createRecipeIngredients(allIngredients)
  logger.info(`Created ${allIngredients.length} recipe ingredients.`)

  logger.info("Recipe seed completed.")
}
