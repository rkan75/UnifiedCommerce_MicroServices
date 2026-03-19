import Overview from "@modules/account/components/overview"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"

/**
 * Fallback when Next.js cannot recover the @dashboard slot state (e.g. hard nav to /account).
 * Renders Overview when logged in, null otherwise; layout will show login slot when no customer.
 */
export default async function DefaultDashboardSlot() {
  const customer = await retrieveCustomer().catch(() => null)
  const orders = (await listOrders().catch(() => null)) || null
  if (!customer) return null
  return <Overview customer={customer} orders={orders} />
}
