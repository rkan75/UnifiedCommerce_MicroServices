/**
 * Example: scheduled subscription processing for Medusa 2.
 *
 * This file is NOT auto-loaded. Use it as a template inside your Medusa app:
 *
 * Option A — `medusa exec` from cron:
 *   npx medusa exec ./src/jobs/process-subscriptions.ts
 *
 * Option B — register a Medusa scheduled job in your module (see Medusa 2 jobs API).
 *
 * Pseudocode below — implement `subscriptionService` and `placeSubscriptionOrder`
 * against your custom module + payment + order workflows.
 */

import type { Logger } from "@medusajs/framework/types"

type ProcessContext = {
  container: {
    resolve: (key: string) => unknown
  }
  logger?: Logger
}

/**
 * Entry point for `medusa exec ./path/to/this-file.ts`
 */
export default async function processDueSubscriptions(_context: ProcessContext) {
  const logger = _context.logger ?? console

  // const subscriptionService = _context.container.resolve("subscriptionService") as SubscriptionService
  // const due = await subscriptionService.listDue({ limit: 100 })
  // for (const sub of due) {
  //   try {
  //     await subscriptionService.runBillingCycle(sub.id) // charge + create order + advance next_run_at
  //   } catch (e) {
  //     logger.error(`Subscription ${sub.id} failed`, e)
  //     await subscriptionService.markPastDue(sub.id)
  //   }
  // }

  logger.info(
    "[subscriptions] Stub: implement listDue + runBillingCycle in your subscription module."
  )
}

/*
 * ---------------------------------------------------------------------------
 * Billing cycle outline (implement in SubscriptionService.runBillingCycle)
 * ---------------------------------------------------------------------------
 * 1. Load subscription + items + customer + region + shipping address.
 * 2. Create idempotency key = `${subscription_id}:${scheduled_for_date}`.
 * 3. If cycle row already `paid` → return.
 * 4. Charge saved payment method off-session (Stripe, etc.).
 * 5. On success → Medusa workflow: create order from subscription lines.
 * 6. Set subscription.last_run_at, compute next_run_at from interval rules.
 * 7. Insert subscription_event { type: 'ORDER_PLACED', payload: { order_id } }.
 * 8. On hard failure → status past_due, notify customer, optional retry schedule.
 */
