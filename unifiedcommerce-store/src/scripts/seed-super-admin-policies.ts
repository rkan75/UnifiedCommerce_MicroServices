/**
 * Ensures the "Super Admin" RBAC role has all registered policies attached.
 * Run this if you see "Insufficient permissions" in admin (e.g. updating variant prices,
 * creating product types, invites, pickup regions / service zones, etc.)
 * even when logged in as a user with the Super Admin role.
 *
 * **Pagination:** `listRbacPolicies` is paginated (default page size). This script loads every
 * page so policies registered after the first batch (e.g. `fulfillment_set:create`,
 * `service_zone:create`) are still attached—otherwise Super Admin can miss them and admin
 * actions fail with "Required policies: …".
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/seed-super-admin-policies.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { FeatureFlag, Modules } from "@medusajs/framework/utils"

type RbacPolicyRow = { id: string; key?: string; resource?: string; operation?: string }

type RbacService = {
  listRbacPolicies: (
    filters?: object,
    config?: { take?: number; skip?: number }
  ) => Promise<RbacPolicyRow[]>
  listRbacRoles: (
    filters?: object,
    config?: { relations?: string[] }
  ) => Promise<{ id: string; name: string; policies?: { id: string }[] }[]>
  createRbacRolePolicies: (data: { role_id: string; policy_id: string }[]) => Promise<unknown[]>
}

const PAGE = 250

async function listAllRbacPolicies(rbacService: RbacService): Promise<RbacPolicyRow[]> {
  const all: RbacPolicyRow[] = []
  let skip = 0
  for (;;) {
    const batch = await rbacService.listRbacPolicies({}, { take: PAGE, skip })
    all.push(...batch)
    if (batch.length < PAGE) break
    skip += PAGE
  }
  return all
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export default async function seedSuperAdminPolicies({ container }: ExecArgs) {
  const rbacEnabled =
    process.env.MEDUSA_FF_RBAC === "true" || FeatureFlag.isFeatureEnabled("rbac")

  if (!rbacEnabled) {
    console.error(
      "❌ RBAC is not enabled. Set MEDUSA_FF_RBAC=true and restart the backend, then run this script again."
    )
    process.exit(1)
  }

  let rbacService: RbacService
  try {
    rbacService = container.resolve(Modules.RBAC) as RbacService
  } catch (err) {
    console.error("❌ RBAC module not available:", err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const [allPolicies, roles] = await Promise.all([
    listAllRbacPolicies(rbacService),
    rbacService.listRbacRoles({ name: "Super Admin" }, { relations: ["policies"] }),
  ])

  if (roles.length === 0) {
    console.error('❌ No role named "Super Admin" found. Run seed-rbac-roles first: npx medusa exec ./src/scripts/seed-rbac-roles.ts')
    process.exit(1)
  }

  const superAdmin = roles[0]
  const existingPolicyIds = new Set((superAdmin.policies ?? []).map((p) => p.id))
  const toAttach = allPolicies.filter((p) => !existingPolicyIds.has(p.id))

  if (toAttach.length === 0) {
    console.log(
      `✅ Super Admin already has all ${allPolicies.length} registered policies attached.`
    )
    console.log("")
    console.log("   If you still see 'Insufficient permissions':")
    console.log("   1. Restart your Medusa backend (clears in-memory permission cache).")
    console.log("   2. Log out of the admin and log back in (so your JWT includes the Super Admin role).")
    console.log("   3. Ensure your user has the 'Super Admin' role (Settings → Users → [you] → Roles).")
    return
  }

  const pairs = toAttach.map((p) => ({ role_id: superAdmin.id, policy_id: p.id }))
  for (const group of chunk(pairs, 50)) {
    await rbacService.createRbacRolePolicies(group)
  }
  console.log(`✅ Attached ${toAttach.length} policies to Super Admin (full registry; includes fulfillment/service_zone if present).`)
  console.log("")
  console.log("⚠️  Do both of these, then try updating the variant price again:")
  console.log("   1. Restart your Medusa backend (clears in-memory permission cache).")
  console.log("   2. Log out of the admin and log back in (so your JWT has the Super Admin role).")
}

