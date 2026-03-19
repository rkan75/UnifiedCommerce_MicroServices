import { Metadata } from "next"

import { listProducts } from "@lib/data/products"
import GiftCardsTemplate from "@modules/gift-cards/templates"

export const metadata: Metadata = {
  title: "Gift Cards",
  description:
    "Give the gift of choice. Our gift cards can be used for any purchase in the store. Available in $10, $25, $50, and $100 denominations.",
}

type Params = {
  params: Promise<{ countryCode: string }>
}

export default async function GiftCardsPage(props: Params) {
  const { countryCode } = await props.params

  const { response } = await listProducts({
    countryCode,
    queryParams: {
      is_giftcard: true,
      limit: 10,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.thumbnail,+metadata,",
    },
  })

  return (
    <GiftCardsTemplate
      products={response.products}
      countryCode={countryCode}
    />
  )
}
