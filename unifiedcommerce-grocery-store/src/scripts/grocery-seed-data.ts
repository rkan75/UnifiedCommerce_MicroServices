/**
 * Grocery product seed data.
 * 100 items per category (800 total), with variants, pricing, and images.
 * Uses a minimal local random helper to avoid ESM/CJS issues with @faker-js/faker in builds.
 */
import { ITEM_NAMES_BY_CATEGORY } from "./grocery-item-names"
import { getProduceImageUrl, isProduceCategory } from "./produce-images"
import { getSnacksImageUrl, isSnacksCategory } from "./snacks-images"

export const GROCERY_CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Beverages",
  "Bakery",
  "Pantry",
  "Frozen",
  "Deli",
  "Snacks",
] as const

export const GROCERY_TAG_VALUES = [
  "organic",
  "gluten-free",
  "dairy-free",
  "vegan",
  "non-GMO",
  "local",
  "fair-trade",
  "low-sodium",
  "natural",
  "keto",
]

type Template = {
  title: string
  description: string
  category: (typeof GROCERY_CATEGORIES)[number]
  tags: string[]
  optionValues: Record<string, string[]>
}

/** Default option so every product has at least one variant (Medusa requirement). */
const DEFAULT_OPTION: Record<string, string[]> = { "Size": ["Regular", "Large"] }

/** Lightweight random helpers (avoids ESM-only @faker-js/faker in CommonJS builds). */
const rand = {
  int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  alphanumeric: (len: number) =>
    "abcdefghijklmnopqrstuvwxyz0123456789"
      .split("")
      .sort(() => Math.random() - 0.5)
      .slice(0, len)
      .join(""),
  arrayElement: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
  arrayElements: <T>(arr: T[], min: number, max: number): T[] => {
    const n = Math.min(max, rand.int(min, Math.min(max, arr.length)))
    return arr
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, n)
  },
}

const FAKE_DESCRIPTIONS = [
  "Premium quality. Great value.",
  "Fresh and flavorful.",
  "Perfect for everyday use.",
  "Quality you can trust.",
  "Delicious and nutritious.",
]

function defaultDescription(title: string, category: string): string {
  return `Fresh ${title.toLowerCase()}. Quality ${category.toLowerCase()} for your table.`
}

/** Build 100 templates per category from item names (800 total). */
function buildTemplatesFromItemNames(): Template[] {
  const out: Template[] = []
  const tagPool = [...GROCERY_TAG_VALUES]
  for (const cat of GROCERY_CATEGORIES) {
    const names = ITEM_NAMES_BY_CATEGORY[cat]
    for (const title of names) {
      out.push({
        title,
        description: defaultDescription(title, cat),
        category: cat,
        tags: rand.arrayElements(tagPool, 0, 3),
        optionValues: { ...DEFAULT_OPTION },
      })
    }
  }
  return out
}

const GROCERY_PRODUCT_TEMPLATES: Template[] = buildTemplatesFromItemNames()

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Generate a unique handle from title + short random suffix */
function uniqueHandle(title: string, used: Set<string>): string {
  const base = slugify(title)
  let handle = base
  let n = 0
  while (used.has(handle)) {
    handle = `${base}-${rand.alphanumeric(4).toLowerCase()}`
    n++
    if (n > 100) break
  }
  used.add(handle)
  return handle
}

/** Build variant option map from option title -> value */
function variantOptions(
  optionTitles: string[],
  valueCombo: string[]
): Record<string, string> {
  const opts: Record<string, string> = {}
  optionTitles.forEach((title, i) => {
    opts[title] = valueCombo[i]
  })
  return opts
}

/** Cartesian product of option value arrays */
function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = cartesian(rest)
  return first.flatMap((v) => restProduct.map((r) => [v, ...r]))
}

/** Stable placeholder image URL per product (main and variant thumbnails). */
export function productImageUrl(seed: string, width = 400, height = 400): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`
}

export type GroceryProductSeed = {
  title: string
  description: string
  handle: string
  category: (typeof GROCERY_CATEGORIES)[number]
  tagValues: string[]
  weight: number
  /** Main product image URLs; first is used as thumbnail. */
  images: string[]
  thumbnail: string
  options: { title: string; values: string[] }[]
  variants: Array<{
    title: string
    sku: string
    options: Record<string, string>
    prices: Array<{ amount: number; currency_code: string }>
    /** Variant-specific image URL (e.g. for size/color); falls back to product thumbnail in storefront. */
    image?: string
  }>
}

const usedHandles = new Set<string>()

/**
 * Generate one grocery product seed from a template, with Faker-used titles/descriptions and realistic prices.
 */
export function buildGroceryProductFromTemplate(
  template: (typeof GROCERY_PRODUCT_TEMPLATES)[number]
): GroceryProductSeed {
  const title = template.title.startsWith("Organic ")
    ? rand.arrayElement([template.title, template.title.replace("Organic ", "")])
    : template.title
  const description =
    template.description +
    " " +
    rand.arrayElement(FAKE_DESCRIPTIONS)
  const handle = uniqueHandle(title, usedHandles)
  const tagValues =
    template.tags.length > 0
      ? rand.arrayElements(template.tags, 0, template.tags.length)
      : []
  const weight = rand.int(100, 2000)
  const optionEntries = Object.entries(template.optionValues)
  const optionTitles = optionEntries.map(([t]) => t)
  const valueArrays = optionEntries.map(([, v]) => v)
  const combos = cartesian(valueArrays)
  const basePriceCents = rand.int(199, 1499)
  const options = optionEntries.map(([title, values]) => ({ title, values }))
  const isProduce = isProduceCategory(template.category)
  const isSnacks = isSnacksCategory(template.category)
  const mainImageUrl = isProduce
    ? getProduceImageUrl(template.title)
    : isSnacks
      ? getSnacksImageUrl(template.title)
      : productImageUrl(handle, 400, 400)
  const secondImageUrl = isProduce
    ? getProduceImageUrl(template.title)
    : isSnacks
      ? getSnacksImageUrl(template.title)
      : productImageUrl(`${handle}-2`, 400, 400)

  const variants = combos.map((valueCombo, idx) => {
    const variantTitle = valueCombo.join(" / ")
    const sku = `${slugify(template.title).slice(0, 8).toUpperCase()}-${valueCombo.map((v) => slugify(v).slice(0, 4)).join("-")}-${idx + 1}`.toUpperCase()
    const priceCents = basePriceCents + idx * 50
    const variantImage = isProduce
      ? getProduceImageUrl(template.title)
      : isSnacks
        ? getSnacksImageUrl(template.title)
        : productImageUrl(`${handle}-${idx}`, 400, 400)
    return {
      title: variantTitle,
      sku,
      options: variantOptions(optionTitles, valueCombo),
      prices: [
        { amount: priceCents, currency_code: "eur" },
        { amount: priceCents, currency_code: "usd" },
      ],
      image: variantImage,
    }
  })
  const images = [mainImageUrl, secondImageUrl]
  return {
    title,
    description,
    handle,
    category: template.category,
    tagValues,
    weight,
    images,
    thumbnail: images[0],
    options,
    variants,
  }
}

/** Build all grocery product seeds from templates (optionally repeat for more products) */
export function buildAllGroceryProducts(countPerTemplate = 1): GroceryProductSeed[] {
  const out: GroceryProductSeed[] = []
  for (let i = 0; i < countPerTemplate; i++) {
    for (const template of GROCERY_PRODUCT_TEMPLATES) {
      out.push(buildGroceryProductFromTemplate(template))
    }
  }
  return out
}
