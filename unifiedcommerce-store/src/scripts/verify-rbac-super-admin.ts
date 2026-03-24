/**
 * Verifies that the Super Admin role has policies and prints steps to fix
 * "Insufficient permissions" if the backend still denies access.
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/verify-rbac-super-admin.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { FeatureFlag, Modules } from "@medusajs/framework/utils"

type RbacPolicy = { resource?: string; operation?: string }

type RbacService = {
  listRbacRoles: (
    filters?: object,
    config?: { relations?: string[] }
  ) => Promise<{ id: string; name: string; policies?: RbacPolicy[] }[]>
}

function matchesProductTypePolicy(p: RbacPolicy): boolean {
  const r = (p.resource ?? "").toLowerCase()
  return r === "product_type" || r.includes("product_type") || r.includes("product-type")
}

export default async function verifyRbacSuperAdmin({ container }: ExecArgs) {
  const rbacEnabled =
    process.env.MEDUSA_FF_RBAC === "true" || FeatureFlag.isFeatureEnabled("rbac")

  if (!rbacEnabled) {
    console.log("RBAC is not enabled. No need to verify.")
    return
  }

  let rbacService: RbacService
  try {
    rbacService = container.resolve(Modules.RBAC) as RbacService
  } catch {
    console.log("RBAC module not available.")
    return
  }

  const roles = await rbacService.listRbacRoles(
    { name: "Super Admin" },
    { relations: ["policies"] }
  )

  if (roles.length === 0) {
    console.log('No "Super Admin" role found. Run: npx medusa exec ./src/scripts/seed-rbac-roles.ts')
    return
  }

  const superAdmin = roles[0]
  const policies = superAdmin.policies ?? []
  const hasUpdate = policies.some((p) => p.resource === "product_variant" && p.operation === "update")
  const hasDelete = policies.some((p) => p.resource === "product_variant" && p.operation === "delete")
  const hasProductTypeCreate = policies.some(
    (p) => matchesProductTypePolicy(p) && p.operation === "create"
  )

  console.log(`Super Admin role: ${superAdmin.id}`)
  console.log(`Attached policies: ${policies.length}`)
  if (policies.length === 0) {
    console.log("")
    console.log(
      "❌ Super Admin has no policies attached. The role seed only creates role names — not permissions."
    )
    console.log(
      '   That causes "Insufficient permissions" for product types, variant prices, invites, etc.'
    )
    console.log("")
    console.log("Run: npx medusa exec ./src/scripts/seed-super-admin-policies.ts")
    console.log("Then: restart backend, log out of admin, log back in.")
    return
  }
  console.log(`  product_variant update: ${hasUpdate ? "yes" : "no"}`)
  console.log(`  product_variant delete: ${hasDelete ? "yes" : "no"}`)
  console.log(`  product_type create (detected): ${hasProductTypeCreate ? "yes" : "no"}`)

  if (!hasUpdate || !hasDelete) {
    console.log("")
    console.log(
      "Some core policies are missing (or Super Admin is out of date after a Medusa upgrade)."
    )
    console.log("Run: npx medusa exec ./src/scripts/seed-super-admin-policies.ts")
    console.log("Then: restart backend, log out of admin, log back in.")
    return
  }

  if (!hasProductTypeCreate) {
    console.log("")
    console.log(
      "⚠️  Could not detect a product_type + create policy on this role (naming may differ)."
    )
    console.log(
      "   If creating product types still returns Insufficient permissions, re-run seed-super-admin-policies"
    )
    console.log("   and compare with: npx medusa exec ./src/scripts/list-rbac-policies.ts")
  }

  console.log("")
  console.log("If you still get 'Insufficient permissions':")
  console.log("  1. Restart your Medusa backend (permission cache is in-memory).")
  console.log("  2. Log out of the admin and log back in (so your JWT has the Super Admin role).")
  console.log("  3. Ensure your user is assigned the 'Super Admin' role (Settings → Users → [you] → Roles).")
  console.log(
    "  4. Read the error text — it lists Required policies — add those in User & Role Management if needed."
  )
}
