/**
 * Recipe data. Ingredients use productHandle to link to store products (fetched dynamically).
 * Reference: Smart & Final Recipes https://www.smartandfinal.com/sm/pickup/rsid/522/recipes
 */

export type RecipeCategory =
  | "all"
  | "appetizers"
  | "drinks-cocktails"
  | "holiday-seasonal"

/** Category stored on a recipe (excludes "all" which is filter-only) */
export type RecipeCategorySlug = Exclude<RecipeCategory, "all">

export type RecipeIngredient = {
  name: string
  quantity: string
  /** Product handle from store — used to fetch product and Add to cart */
  productHandle?: string
  variantId?: string
}

export type Recipe = {
  id: string
  slug: string
  title: string
  description: string
  category: RecipeCategorySlug
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  image?: string
  ingredients: RecipeIngredient[]
  directions: string[]
}

/** Category display labels */
export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: "all", label: "All Recipes" },
  { value: "appetizers", label: "Appetizers" },
  { value: "drinks-cocktails", label: "Drinks & Cocktails" },
  { value: "holiday-seasonal", label: "Holiday & Seasonal" },
]

/** Mock recipes — productHandle must match a product handle in your Medusa store */
export const RECIPES: Recipe[] = [
  {
    id: "r1",
    slug: "peanut-butter-wrap",
    title: "Peanut Butter Wrap",
    description: "A sweet, simple wrap kids love and parents feel good about. Great for little hands and big appetites.",
    category: "appetizers",
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    servings: 1,
    image: "/peanutbutter.webp",
    ingredients: [
      { name: "Whole wheat tortilla (8-inch)", quantity: "1", productHandle: "romatomoto" },
      { name: "Creamy peanut butter", quantity: "2 tbsp", productHandle: "almondmilk" },
      { name: "Ripe banana", quantity: "1 medium", productHandle: "galaapple" },
      { name: "Honey", quantity: "1 tsp" },
      { name: "Cinnamon", quantity: "1/4 tsp" },
    ],
    directions: [
      "Lay the whole wheat tortilla flat on a clean surface.",
      "Spread the peanut butter evenly over the tortilla.",
      "Slice the ripe banana into thin rounds and place them in the center of the tortilla.",
      "Drizzle honey and sprinkle cinnamon.",
      "Roll the tortilla tightly, starting from one edge.",
      "Slice into bite-sized pieces and serve immediately or store in an airtight container.",
    ],
  },
  {
    id: "r2",
    slug: "crispy-garlic-parmesan-edamame",
    title: "Crispy Garlic Parmesan Edamame",
    description: "Savory edamame with garlic and parmesan. Perfect appetizer.",
    category: "appetizers",
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    servings: 4,
    image: "/roasted-garlic-edamame.webp",
    ingredients: [
      { name: "Frozen edamame", quantity: "12 oz", productHandle: "galaapple" },
      { name: "Olive oil", quantity: "1 tbsp" },
      { name: "Garlic powder", quantity: "1/2 tsp" },
      { name: "Parmesan cheese", quantity: "2 tbsp" },
    ],
    directions: [
      "Preheat oven to 400°F. Toss edamame with olive oil and garlic powder.",
      "Spread on a baking sheet and roast 12–15 minutes until crisp.",
      "Toss with parmesan and serve warm.",
    ],
  },
  {
    id: "r3",
    slug: "holiday-lemon-drop",
    title: "Holiday Lemon Drop",
    description: "Drinks served in tall glass garnished with lemon, cranberries, and rosemary.",
    category: "drinks-cocktails",
    prepTimeMinutes: 5,
    cookTimeMinutes: 0,
    servings: 1,
    ingredients: [
      { name: "Vodka", quantity: "2 oz" },
      { name: "Fresh lemon juice", quantity: "1 oz", productHandle: "galaapple" },
      { name: "Simple syrup", quantity: "3/4 oz" },
      { name: "Ice" },
    ],
    directions: [
      "Combine vodka, lemon juice, and simple syrup in a shaker with ice.",
      "Shake well and strain into a chilled glass.",
      "Garnish with lemon slice, cranberries, and rosemary.",
    ],
  },
  {
    id: "r4",
    slug: "pumpkin-alfredo-pasta",
    title: "Pumpkin Alfredo Pasta",
    description: "Pumpkin pasta served with toasted pumpkin seeds.",
    category: "holiday-seasonal",
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    servings: 4,
    ingredients: [
      { name: "Pasta", quantity: "1 lb", productHandle: "romatomoto" },
      { name: "Pumpkin puree", quantity: "1 cup" },
      { name: "Heavy cream", quantity: "1/2 cup", productHandle: "almondmilk" },
      { name: "Parmesan", quantity: "1/2 cup" },
      { name: "Pumpkin seeds", quantity: "2 tbsp" },
    ],
    directions: [
      "Cook pasta according to package directions. Reserve 1/2 cup pasta water.",
      "In a skillet, warm pumpkin puree and cream. Stir in parmesan until smooth.",
      "Toss with drained pasta and pasta water. Top with toasted pumpkin seeds.",
    ],
  },
  {
    id: "r5",
    slug: "apple-crumble",
    title: "Apple Crumble",
    description: "Classic apple crumble with cinnamon and oat topping.",
    category: "holiday-seasonal",
    prepTimeMinutes: 15,
    cookTimeMinutes: 35,
    servings: 6,
    ingredients: [
      { name: "Apples", quantity: "6 medium", productHandle: "galaapple" },
      { name: "Rolled oats", quantity: "1 cup" },
      { name: "Flour", quantity: "1/2 cup" },
      { name: "Brown sugar", quantity: "1/2 cup" },
      { name: "Butter", quantity: "1/3 cup" },
      { name: "Cinnamon", quantity: "1 tsp" },
    ],
    directions: [
      "Preheat oven to 375°F. Slice apples and place in a baking dish.",
      "Mix oats, flour, brown sugar, and cinnamon. Cut in butter until crumbly.",
      "Sprinkle topping over apples. Bake 35–40 minutes until golden.",
    ],
  },
]

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return RECIPES.find((r) => r.slug === slug)
}

export function getRecipesByCategory(category: RecipeCategory): Recipe[] {
  if (category === "all") return RECIPES
  return RECIPES.filter((r) => r.category === category)
}
