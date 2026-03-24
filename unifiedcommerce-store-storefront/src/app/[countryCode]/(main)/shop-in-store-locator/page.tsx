import { retrieveCart } from "@lib/data/cart"
import ShopInStoreLocatorTemplate from "@modules/checkout/templates/shop-in-store-locator"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Choose store — Shop in store",
  description: "Find a store to create your in-store shopping list.",
}

type PageProps = {
  params: Promise<{ countryCode: string }>
}

export default async function ShopInStoreLocatorPage({ params }: PageProps) {
  const { countryCode } = await params
  const cart = await retrieveCart()

  if (!cart) {
    notFound()
  }

  return (
    <ShopInStoreLocatorTemplate cart={cart} countryCode={countryCode} />
  )
}
