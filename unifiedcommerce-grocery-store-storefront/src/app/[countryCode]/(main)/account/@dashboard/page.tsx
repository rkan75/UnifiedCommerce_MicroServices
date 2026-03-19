import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"

export const metadata: Metadata = {
  title: "Account",
  description: "Overview of your account activity.",
}

export default async function OverviewTemplate() {
  const customer = await retrieveCustomer().catch(() => null)
  const orders = (await listOrders().catch(() => null)) || null

  // When not logged in, layout shows login slot; dashboard slot can render nothing
  if (!customer) {
    return null
  }

  return <Overview customer={customer} orders={orders} />
}
