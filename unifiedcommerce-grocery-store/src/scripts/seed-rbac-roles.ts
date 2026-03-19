import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, FeatureFlag, Modules } from "@medusajs/framework/utils"
import { createRbacRolesWorkflow } from "@medusajs/medusa/core-flows"

const PREDEFINED_ROLES = [
  { name: "Super Admin", description: "Full access to everything" },
  { name: "Admin", description: "Full access except user/role management" },
  { name: "Order Manager", description: "Orders, fulfillments, returns, refunds" },
  { name: "Product Manager", description: "Products, variants, categories, inventory" },
  { name: "Content Manager", description: "Products (edit), categories, collections" },
  { name: "Inventory Manager", description: "Inventory, stock locations" },
  { name: "Customer Support", description: "Customers, orders (view/update), returns" },
  { name: "Viewer", description: "Read-only access" },
  { name: "Finance", description: "Orders, payments, refunds, price lists" },
  { name: "Settings Manager", description: "Regions, tax, shipping, store settings" },
]

export default async function seedRbacRoles({ container }: ExecArgs) {
  // Check if RBAC feature flag is enabled (check env var first, then FeatureFlag)
  const rbacEnabled =
    process.env.MEDUSA_FF_RBAC === "true" || FeatureFlag.isFeatureEnabled("rbac")

  if (!rbacEnabled) {
    console.error(
      "❌ RBAC feature flag is not enabled.\n" +
        "\nPlease do the following:\n" +
        "1. Set MEDUSA_FF_RBAC=true in your .env file\n" +
        "2. Add RBAC module to medusa-config.ts (see updated config)\n" +
        "3. Restart your Medusa backend completely\n" +
        "4. Then run this script again: npx medusa exec ./src/scripts/seed-rbac-roles.ts"
    )
    process.exit(1)
  }

  // Check if RBAC module is available
  let rbacService
  try {
    rbacService = container.resolve(Modules.RBAC) as {
      listRbacRoles: (filters?: object) => Promise<{ id: string; name: string }[]>
    }
  } catch (err) {
    console.error(
      "❌ RBAC module is not available in the container.\n" +
        "\nThis usually means:\n" +
        "1. MEDUSA_FF_RBAC=true is set, but RBAC module is not added to medusa-config.ts\n" +
        "2. The backend wasn't restarted after adding RBAC to the config\n" +
        "\nSolution:\n" +
        "1. Ensure MEDUSA_FF_RBAC=true is in your .env file\n" +
        "2. Ensure medusa-config.ts includes RBAC module (should be added automatically)\n" +
        "3. Restart your Medusa backend completely\n" +
        "4. Run this script again"
    )
    console.error("\nError details:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  try {
    const existing = await rbacService.listRbacRoles({})
    const existingNames = new Set(existing.map((r) => r.name))
    const toCreate = PREDEFINED_ROLES.filter((r) => !existingNames.has(r.name))
    
    if (toCreate.length === 0) {
      console.log("✅ All predefined RBAC roles already exist, skipping seed.")
      return
    }

    const { result } = await createRbacRolesWorkflow(container).run({
      input: {
        roles: toCreate,
      },
    })
    console.log(`✅ Created ${result.length} RBAC roles: ${result.map((r) => r.name).join(", ")}`)
  } catch (err) {
    console.error("❌ Error creating RBAC roles:", err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
