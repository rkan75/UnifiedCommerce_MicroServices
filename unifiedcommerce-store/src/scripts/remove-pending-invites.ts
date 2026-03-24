/**
 * Removes all invites that were never accepted (invited but not registered).
 * Uses the User module's softDeleteInvites so they no longer appear in the admin.
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/remove-pending-invites.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function removePendingInvites({ container }: ExecArgs) {
  console.log("🔍 Finding invites that were never accepted...\n")

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: {
      entity: string
      fields: string[]
      filters?: object
    }) => Promise<{ data: any[] }>
  }

  const { data: invites } = await query.graph({
    entity: "invite",
    fields: ["id", "email", "accepted", "created_at"],
  })

  const pending = (invites ?? []).filter((inv: { accepted?: boolean }) => !inv.accepted)

  if (pending.length === 0) {
    console.log("✅ No pending invites to remove.")
    return
  }

  console.log(`Found ${pending.length} pending invite(s):`)
  pending.forEach((inv: { id: string; email: string; created_at?: string }) => {
    console.log(`   - ${inv.email} (${inv.id})`)
  })

  const userModule = container.resolve(Modules.USER) as {
    softDeleteInvites: (ids: string[]) => Promise<void>
  }

  const ids = pending.map((inv: { id: string }) => inv.id)
  await userModule.softDeleteInvites(ids)

  console.log(`\n✅ Removed ${ids.length} pending invite(s). They will no longer appear in the admin.`)
}
