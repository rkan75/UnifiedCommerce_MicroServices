/**
 * Lists all RBAC policies and what's attached to Super Admin.
 * Run: npx medusa exec ./src/scripts/list-rbac-policies.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { FeatureFlag, Modules } from "@medusajs/framework/utils"

type PolicyRow = {
  id: string
  name?: string
  resource?: string
  operation?: string
  key?: string
}

type RbacService = {
  listRbacPolicies: (
    filters?: object,
    config?: { take?: number; skip?: number }
  ) => Promise<PolicyRow[]>
  listRbacRoles: (
    filters?: object,
    config?: { relations?: string[] }
  ) => Promise<{ id: string; name: string; policies?: { id: string; resource?: string; operation?: string; name?: string; key?: string }[] }[]>
}

const PAGE = 250

async function listAllRbacPolicies(rbac: RbacService): Promise<PolicyRow[]> {
  const all: PolicyRow[] = []
  let skip = 0
  for (;;) {
    const batch = await rbac.listRbacPolicies({}, { take: PAGE, skip })
    all.push(...batch)
    if (batch.length < PAGE) break
    skip += PAGE
  }
  return all
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
    listAllRbacPolicies(rbacService),
    rbacService.listRbacRoles({ name: "Super Admin" }, { relations: ["policies"] }),
  ])

  console.log("All registered policies (all pages):", allPolicies.length)
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

  const productTypePolicies = allPolicies.filter(
    (p) =>
      (p.resource && /product[_-]?type/i.test(p.resource)) ||
      (p.name && /product[_-]?type/i.test(String(p.name))) ||
      (p.key && /product[_-]?type/i.test(String(p.key)))
  )
  if (productTypePolicies.length > 0) {
    console.log("  product_type related:", productTypePolicies.length)
    productTypePolicies.forEach((p) =>
      console.log("    -", JSON.stringify({ id: p.id, resource: p.resource, operation: p.operation, name: p.name, key: p.key }))
    )
  }

  const fulfillmentPolicies = allPolicies.filter(
    (p) =>
      (p.resource && /fulfillment_set|service_zone/i.test(p.resource)) ||
      (p.key && /fulfillment_set|service_zone/i.test(String(p.key)))
  )
  if (fulfillmentPolicies.length > 0) {
    console.log("  fulfillment_set / service_zone related:", fulfillmentPolicies.length)
    fulfillmentPolicies.forEach((p) =>
      console.log("    -", JSON.stringify({ id: p.id, resource: p.resource, operation: p.operation, key: p.key }))
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
  if (allPolicies.length > 0 && attached.length < allPolicies.length) {
    console.log(
      `  ⚠️  Missing ${allPolicies.length - attached.length} policies vs full registry — run seed-super-admin-policies.ts`
    )
  }
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
