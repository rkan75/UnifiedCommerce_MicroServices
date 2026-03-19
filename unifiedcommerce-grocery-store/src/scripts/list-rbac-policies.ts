/**
 * Lists all RBAC policies and what's attached to Super Admin.
 * Run: npx medusa exec ./src/scripts/list-rbac-policies.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { FeatureFlag, Modules } from "@medusajs/framework/utils"

type RbacService = {
  listRbacPolicies: (filters?: object) => Promise<{ id: string; name?: string; resource?: string; operation?: string; key?: string }[]>
  listRbacRoles: (
    filters?: object,
    config?: { relations?: string[] }
  ) => Promise<{ id: string; name: string; policies?: { id: string; resource?: string; operation?: string; name?: string; key?: string }[] }[]>
}

export default async function listRbacPolicies({ container }: ExecArgs) {
  const rbacEnabled =
    process.env.MEDUSA_FF_RBAC === "true" || FeatureFlag.isFeatureEnabled("rbac")

  if (!rbacEnabled) {
    console.log("RBAC is not enabled (MEDUSA_FF_RBAC is not true).")
    return
  }

  let rbacService: RbacService
  try {
    rbacService = container.resolve(Modules.RBAC) as RbacService
  } catch {
    console.log("RBAC module not available.")
    return
  }

  const [allPolicies, roles] = await Promise.all([
    rbacService.listRbacPolicies({}),
    rbacService.listRbacRoles({ name: "Super Admin" }, { relations: ["policies"] }),
  ])

  console.log("All registered policies:", allPolicies.length)
  const productVariantPolicies = allPolicies.filter(
    (p) =>
      (p.resource && p.resource.includes("product_variant")) ||
      (p.name && p.name.includes("product_variant")) ||
      (p.key && p.key.includes("product_variant"))
  )
  if (productVariantPolicies.length > 0) {
    console.log("  product_variant related:", productVariantPolicies.length)
    productVariantPolicies.forEach((p) =>
      console.log("    -", JSON.stringify({ id: p.id, resource: p.resource, operation: p.operation, name: p.name, key: p.key }))
    )
  }

  if (roles.length === 0) {
    console.log('\nNo "Super Admin" role. Run: npx medusa exec ./src/scripts/seed-rbac-roles.ts')
    return
  }

  const superAdmin = roles[0]
  const attached = superAdmin.policies ?? []
  console.log("\nSuper Admin role:", superAdmin.id)
  console.log("Policies attached to Super Admin:", attached.length)
  const hasProductVariant = attached.some(
    (p) =>
      (p.resource && p.resource.includes("product_variant")) ||
      (p.name && (p.name as string).includes("product_variant")) ||
      (p.key && (p.key as string).includes("product_variant"))
  )
  console.log("  Has product_variant policy:", hasProductVariant ? "yes" : "no")
  if (!hasProductVariant && attached.length > 0) {
    console.log("  First 5 attached:", attached.slice(0, 5).map((p) => ({ id: p.id, resource: p.resource, operation: p.operation })))
  }

  if (attached.length === 0) {
    console.log("\n→ Run: npx medusa exec ./src/scripts/seed-super-admin-policies.ts")
  } else if (!hasProductVariant) {
    console.log("\n→ product_variant policies may use different keys. Fix by running seed-super-admin-policies.ts, then restart backend and log out/in.")
  }
}
