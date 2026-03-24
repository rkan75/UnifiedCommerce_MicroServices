/**
 * Seed gift card product with denominations $10, $25, $50, $100.
 *
 * Run after main seed (npm run seed):
 *   npx medusa exec ./src/scripts/seed-gift-cards.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { batchVariantImagesWorkflow } from "@medusajs/medusa/core-flows"

const GIFT_CARD_HANDLE = "gift-card"
const GIFT_CARD_CATEGORY_HANDLE = "gift-cards"
const DENOMINATIONS = [
  { amount: 1000, title: "$10", sku: "GC-10" },
  { amount: 2500, title: "$25", sku: "GC-25" },
  { amount: 5000, title: "$50", sku: "GC-50" },
  { amount: 10000, title: "$100", sku: "GC-100" },
]

export default async function seedGiftCards({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const regionModuleService = container.resolve(Modules.REGION)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const [region] = await regionModuleService.listRegions({})
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  const [shippingProfile] = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })

  if (!region || !defaultSalesChannel) {
    logger.warn("Region or Default Sales Channel not found. Run main seed first.")
    return
  }

  if (!shippingProfile) {
    logger.warn("No shipping profile found. Run main seed first.")
    return
  }

  let giftCardCategoryId: string | null = null
  const existingCategories = await productModuleService.listProductCategories(
    { name: "Gift Cards" },
    { take: 1 }
  )
  if (existingCategories.length > 0) {
    giftCardCategoryId = existingCategories[0].id
    logger.info("Using existing Gift Cards category.")
  } else {
    const created = await productModuleService.createProductCategories({
      name: "Gift Cards",
      handle: GIFT_CARD_CATEGORY_HANDLE,
      is_active: true,
    })
    giftCardCategoryId = Array.isArray(created) ? created[0]?.id : (created as { id: string })?.id
    logger.info("Created Gift Cards category.")
  }

  const existingProducts = await productModuleService.listProducts(
    { handle: GIFT_CARD_HANDLE },
    { take: 1 }
  )
  if (existingProducts.length > 0) {
    logger.info("Gift card product already exists, skipping.")
    return
  }

  const productInput = {
    title: "Gift Card",
    description:
      "Give the gift of choice. Our gift cards can be used for any purchase in the store. Available in $10, $25, $50, and $100 denominations.",
    handle: GIFT_CARD_HANDLE,
    status: ProductStatus.PUBLISHED,
    is_giftcard: true,
    discountable: false,
    thumbnail: "https://picsum.photos/seed/giftcard/400/400",
    images: [{ url: "https://picsum.photos/seed/giftcard/400/400" }],
    ...(giftCardCategoryId && { category_ids: [giftCardCategoryId] }),
    shipping_profile_id: shippingProfile.id,
    options: [{ title: "Amount", values: DENOMINATIONS.map((d) => d.title) }],
    variants: DENOMINATIONS.map((d) => ({
      title: d.title,
      sku: d.sku,
      options: { Amount: d.title },
      prices: [
        {
          region_id: region.id,
          currency_code: region.currency_code ?? "usd",
          amount: d.amount,
        },
      ],
    })),
    sales_channels: [{ id: defaultSalesChannel.id }],
  }

  const { result: created } = await createProductsWorkflow(container).run({
    input: { products: [productInput] },
  })

  const product = Array.isArray(created) ? created[0] : created
  const createdProduct = product as { id: string; images?: { id: string }[]; variants?: { id: string }[] }

  if (createdProduct?.images?.length && createdProduct?.variants?.length) {
    const firstImageId = createdProduct.images[0]?.id
    for (const v of createdProduct.variants) {
      if (firstImageId && v.id) {
        await batchVariantImagesWorkflow(container).run({
          input: { variant_id: v.id, add: [firstImageId] },
        })
      }
    }
  }

  logger.info(
    `Created gift card product with denominations: ${DENOMINATIONS.map((d) => d.title).join(", ")}`
  )
}
