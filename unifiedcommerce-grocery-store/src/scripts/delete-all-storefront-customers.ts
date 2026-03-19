/**
 * Completely deletes all storefront customers. For each customer this:
 * - Soft-deletes the customer (so they no longer appear in the storefront)
 * - Unlinks their auth identity (emailpass) so login is no longer possible
 *
 * Use this to wipe all customer data (e.g. for a fresh demo or testing).
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/delete-all-storefront-customers.ts
 *
 * Optional: confirm with env to avoid accidental runs:
 *   CONFIRM_DELETE_ALL_CUSTOMERS=yes npx medusa exec ./src/scripts/delete-all-storefront-customers.ts
 */

import { removeCustomerAccountWorkflow } from "@medusajs/core-flows"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function deleteAllStorefrontCustomers({ container }: ExecArgs) {
  const confirm = process.env.CONFIRM_DELETE_ALL_CUSTOMERS === "yes"

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: {
      entity: string
      fields: string[]
      filters?: object
    }) => Promise<{ data: { id: string; email?: string }[] }>
  }

  let customers: { id: string; email?: string }[] = []
  try {
    const result = await query.graph({
      entity: "customer",
      fields: ["id", "email"],
    })
    customers = result?.data ?? []
  } catch (e) {
    // Fallback: resolve Customer module directly if query entity name differs
    try {
      const customerModule = container.resolve(Modules.CUSTOMER ?? "customer") as {
        listCustomers: (filters?: object, config?: { take?: number }) => Promise<{ id: string; email?: string }[]>
      }
      customers = await customerModule.listCustomers?.({}, { take: 10000 }) ?? []
    } catch (e2) {
      console.error("Could not list customers:", (e as Error).message)
      process.exit(1)
    }
  }

  if (customers.length === 0) {
    console.log("No storefront customers found. Nothing to delete.")
    return
  }

  if (!confirm) {
    console.log(`Found ${customers.length} storefront customer(s).`)
    console.log("To delete ALL of them, run:")
    console.log("  CONFIRM_DELETE_ALL_CUSTOMERS=yes npx medusa exec ./src/scripts/delete-all-storefront-customers.ts")
    return
  }

  const workflow = removeCustomerAccountWorkflow(container)
  let done = 0
  for (const c of customers) {
    try {
      await workflow.run({ input: { customerId: c.id } })
      done++
      console.log(`  Deleted: ${c.email ?? c.id}`)
    } catch (err) {
      console.warn(`  Failed to delete ${c.email ?? c.id}:`, (err as Error).message)
    }
  }

  console.log(`\nDone. Removed ${done} of ${customers.length} storefront customer(s).`)
}
