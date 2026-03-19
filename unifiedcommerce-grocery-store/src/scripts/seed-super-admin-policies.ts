/**
 * Ensures the "Super Admin" RBAC role has all registered policies attached.
 * Run this if you see "Insufficient permissions" in admin (e.g. updating variant prices)
 * even when logged in as a user with the Super Admin role.
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/seed-super-admin-policies.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { FeatureFlag, Modules } from "@medusajs/framework/utils"

type RbacService = {
  listRbacPolicies: (filters?: object, config?: object) => Promise<{ id: string; key?: string }[]>
  listRbacRoles: (
    filters?: object,
    config?: { relations?: string[] }
  ) => Promise<{ id: string; name: string; policies?: { id: string }[] }[]>
  createRbacRolePolicies: (data: { role_id: string; policy_id: string }[]) => Promise<unknown[]>
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
    rbacService.listRbacPolicies({}),
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
    console.log("✅ Super Admin already has all policies attached.")
    console.log("")
    console.log("   If you still see 'Insufficient permissions':")
    console.log("   1. Restart your Medusa backend (clears in-memory permission cache).")
    console.log("   2. Log out of the admin and log back in (so your JWT includes the Super Admin role).")
    console.log("   3. Ensure your user has the 'Super Admin' role (Settings → Users → [you] → Roles).")
    return
  }

  await rbacService.createRbacRolePolicies(
    toAttach.map((p) => ({ role_id: superAdmin.id, policy_id: p.id }))
  )
  console.log(`✅ Attached ${toAttach.length} policies to Super Admin (e.g. product_variant update/delete).`)
  console.log("")
  console.log("⚠️  Do both of these, then try updating the variant price again:")
  console.log("   1. Restart your Medusa backend (clears in-memory permission cache).")
  console.log("   2. Log out of the admin and log back in (so your JWT has the Super Admin role).")
}

