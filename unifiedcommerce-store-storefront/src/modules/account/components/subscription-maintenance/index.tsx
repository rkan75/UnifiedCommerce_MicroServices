import SubscriptionCard from "./subscription-card"
import type { StoreSubscription } from "types/subscription"

export default function SubscriptionMaintenance({
  subscriptions,
}: {
  subscriptions: StoreSubscription[]
}) {
  if (!subscriptions.length) {
    return (
      <div
        className="rounded-lg border border-dashed border-ui-border-base bg-ui-bg-subtle p-8 text-center"
        data-testid="subscriptions-empty"
      >
        <p className="text-base-regular text-ui-fg-subtle">
          You don&apos;t have any active subscriptions yet. When you subscribe
          to eligible products, they will appear here with refill dates, payment
          method, and shipping details.
        </p>
        <p className="mt-4 text-small-regular text-ui-fg-muted">
          Use Subscribe &amp; Save on eligible products, then open this page again.
          Active refills appear after you complete an order; items still in your cart
          may show as draft with a projected date.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-6">
      {subscriptions.map((sub) => (
        <li key={sub.id}>
          <SubscriptionCard subscription={sub} />
        </li>
      ))}
    </ul>
  )
}
