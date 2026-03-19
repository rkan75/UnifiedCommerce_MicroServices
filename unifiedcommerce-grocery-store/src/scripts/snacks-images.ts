/**
 * Curated image URLs for Snacks category items.
 * Uses Picsum Photos (https://picsum.photos) with deterministic seeds so every
 * URL is guaranteed accessible and already whitelisted in the storefront.
 * Format: https://picsum.photos/seed/{seed}/400/400
 */
const W = 400
const H = 400

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*&\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Picsum URL by seed – always accessible, stable per product. */
const picsum = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${W}/${H}`

// Snacks: one seed per item so each product has a stable, unique image from picsum
const SNACKS_IMAGES: Record<string, string> = {}
const SNACKS_TITLES = [
  "Potato Chips", "Tortilla Chips", "Corn Chips", "Pita Chips", "Pretzels", "Popcorn",
  "Cheese Popcorn", "Caramel Popcorn", "Mixed Nuts", "Trail Mix", "Peanuts", "Cashews",
  "Almonds", "Pistachios", "Sunflower Seeds", "Pumpkin Seeds", "Granola Bars", "Protein Bars",
  "Energy Bars", "Fruit Snacks", "Fruit Leather", "Dried Fruit", "Veggie Chips", "Kale Chips",
  "Banana Chips", "Plantain Chips", "Crackers", "Cheese Crackers", "Graham Crackers",
  "Rice Cakes", "Rice Crackers", "Popcorn Cakes", "Cheese Puffs", "Pirate's Booty",
  "Goldfish", "Animal Crackers", "Teddy Grahams", "Cookies", "Brownie Bites",
  "Mini Muffins", "Candy Chocolate", "Candy Gummy", "Candy Hard", "Chocolate Bar",
  "Dark Chocolate", "Milk Chocolate", "Peanut Butter Cups", "Chocolate Covered Nuts",
  "Chocolate Covered Raisins", "Licorice", "Jelly Beans", "M&Ms", "Skittles", "Starburst",
  "Sour Patch Kids", "Haribo Gummy Bears", "Swedish Fish", "Twizzlers", "Reese's",
  "Snickers", "Kit Kat", "Twix", "Hershey's", "Milk Duds", "Whoppers", "Raisinets",
  "Tootsie Rolls", "Junior Mints", "York Peppermint", "Almond Joy", "Mounds",
  "Beef Jerky", "Turkey Jerky", "Meat Sticks", "String Cheese", "Cheese Cubes",
  "Pepperoni Sticks", "Salami Sticks", "Hummus and Pretzels", "Crackers and Cheese",
  "Apple Sauce Pouches", "Yogurt Pouches", "Squeeze Pouch Fruit", "Veggie Straws",
  "Sweet Potato Chips", "Bean Chips", "Lentil Chips", "Quinoa Chips", "Keto Snacks",
  "Low Carb Crackers", "Sugar-Free Candy", "Dark Chocolate Almonds", "Dried Mango",
  "Dried Pineapple", "Dried Apricots", "Dried Figs", "Dried Dates", "Dried Coconut",
  "Freeze-Dried Fruit", "Freeze-Dried Strawberries", "Coconut Chips", "Seaweed Snacks",
  "Wasabi Peas", "Sesame Sticks", "Bugles", "Combos", "Chex Mix", "Gardetto's",
  "Nutella and Breadsticks", "Cookie Dough Bites", "Mini Oreos", "Nutter Butters",
  "Chips Ahoy", "Fig Newtons", "Belvita", "Kind Bars", "Larabars", "Clif Bars",
  "RXBAR", "Quest Bars", "Perfect Bar", "That's It Bars", "Smart Sweets",
  "Popcorners", "Boom Chicka Pop", "SkinnyPop", "Lesser Evil", "Hippeas",
]
for (const title of SNACKS_TITLES) {
  SNACKS_IMAGES[title] = picsum(`snacks-${slug(title)}`)
}

/** Default fallback when no match */
const FALLBACK_SNACKS_IMAGE = picsum("snacks-default")

/**
 * Returns the curated image URL for a Snacks category product by title.
 */
export function getSnacksImageUrl(title: string): string {
  return SNACKS_IMAGES[title] ?? FALLBACK_SNACKS_IMAGE
}

/**
 * Returns true if the given category is Snacks.
 */
export function isSnacksCategory(category: string): boolean {
  return category === "Snacks"
}
