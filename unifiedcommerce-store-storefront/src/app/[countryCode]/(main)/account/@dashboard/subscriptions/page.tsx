import { Metadata } from "next"
import { notFound } from "next/navigation"

import SubscriptionMaintenance from "@modules/account/components/subscription-maintenance"
import { retrieveCustomer } from "@lib/data/customer"
import { listCustomerSubscriptions } from "@lib/data/subscriptions"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Subscriptions",
  description: "Manage subscribe & save refills, payment, and schedule.",
}

export default async function SubscriptionsPage() {
  const customer = await retrieveCustomer().catch(() => null)
  if (!customer) {
    notFound()
  }

  const subscriptions = await listCustomerSubscriptions()

  return (
    <div className="w-full" data-testid="subscriptions-page">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Subscriptions</h1>
        <p className="text-base-regular text-ui-fg-subtle">
          View refill schedule, update payment options, skip a shipment, or pause
          your subscription. Orders are placed automatically based on your plan
          once the Medusa subscription module is connected.
        </p>
      </div>
      <SubscriptionMaintenance subscriptions={subscriptions} />
    </div>
  )
}
