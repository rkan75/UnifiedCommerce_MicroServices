"use server"

import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import FarmFreshProduceClient from "./client"

export default async function FarmFreshProduce({
  countryCode,
}: {
  countryCode: string
}) {
  const region = await getRegion(countryCode)
  if (!region) {
    return null
  }

  // Get all categories
  const categories = await listCategories().catch(() => [])

  // Find category handles (case-insensitive)
  const findCategory = (searchTerms: string[]) => {
    return categories.find((cat) =>
      searchTerms.some(
        (term) =>
          cat.name?.toLowerCase().includes(term.toLowerCase()) ||
          cat.handle?.toLowerCase().includes(term.toLowerCase())
      )
    )
  }

  const vegetablesCategory = findCategory(["vegetable", "produce"])
  const dairyCategory = findCategory(["dairy", "milk"])
  const fruitsCategory = findCategory(["fruit"])
  const meatCategory = findCategory(["meat", "poultry"])

  const TARGET_PRODUCT_COUNT = 4

  // Fetch one product from each category
  const fetchProductFromCategory = async (
    category: HttpTypes.StoreProductCategory | undefined,
    limit = 1
  ) => {
    if (!category) return []

    const { response } = await listProducts({
      countryCode,
      queryParams: {
        category_id: [category.id],
        limit,
      },
    })

    return response.products || []
  }

  const [vegetableProducts, dairyProducts, fruitProducts, meatProducts] =
    await Promise.all([
      fetchProductFromCategory(vegetablesCategory),
      fetchProductFromCategory(dairyCategory),
      fetchProductFromCategory(fruitsCategory),
      fetchProductFromCategory(meatCategory),
    ])

  const categoryLabels = ["Vegetables", "Dairy", "Fruits", "Meat"] as const
  const categoryResults = [
    vegetableProducts,
    dairyProducts,
    fruitProducts,
    meatProducts,
  ]

  // Build list: one product from each category first, then fill to 4 from first available
  const products: Array<{ product: HttpTypes.StoreProduct; category: string }> = []
  const usedIds = new Set<string>()

  for (let i = 0; i < categoryResults.length && products.length < TARGET_PRODUCT_COUNT; i++) {
    const prods = categoryResults[i]
    const label = categoryLabels[i]
    const product = prods.find((p) => p?.id && !usedIds.has(p.id))
    if (product) {
      products.push({ product, category: label })
      usedIds.add(product.id)
    }
  }

  // If we have fewer than 4, fill from produce/vegetables (or first category with more products)
  if (products.length < TARGET_PRODUCT_COUNT) {
    const fillCategory = vegetablesCategory || dairyCategory || fruitsCategory || meatCategory
    const fillLabel =
      vegetablesCategory?.id === fillCategory?.id
        ? "Vegetables"
        : dairyCategory?.id === fillCategory?.id
          ? "Dairy"
          : fruitsCategory?.id === fillCategory?.id
            ? "Fruits"
            : "Meat"
    if (fillCategory) {
      const { response } = await listProducts({
        countryCode,
        queryParams: {
          category_id: [fillCategory.id],
          limit: TARGET_PRODUCT_COUNT,
        },
      })
      const toAdd = (response.products || []).filter(
        (p) => p?.id && !usedIds.has(p.id) && products.length < TARGET_PRODUCT_COUNT
      )
      for (const p of toAdd) {
        products.push({ product: p, category: fillLabel })
        usedIds.add(p.id)
      }
    }
  }

  // If still fewer than 4, fill from all products (no category filter)
  if (products.length < TARGET_PRODUCT_COUNT) {
    const { response } = await listProducts({
      countryCode,
      queryParams: { limit: TARGET_PRODUCT_COUNT * 2 },
    })
    const toAdd = (response.products || []).filter(
      (p) => p?.id && !usedIds.has(p.id) && products.length < TARGET_PRODUCT_COUNT
    )
    for (const p of toAdd) {
      products.push({ product: p, category: "Produce" })
      usedIds.add(p.id)
    }
  }

  // Slice to exactly 4 so we never show more than 4
  const displayProducts = products.slice(0, TARGET_PRODUCT_COUNT)

  if (displayProducts.length === 0) {
    return null
  }

  return (
    <FarmFreshProduceClient
      products={displayProducts}
      region={region}
      countryCode={countryCode}
    />
  )
}
