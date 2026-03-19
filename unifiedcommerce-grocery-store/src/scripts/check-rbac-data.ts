import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function checkRbacData({ container }: ExecArgs) {
  console.log("🔍 Checking RBAC data in database...\n")

  // Check RBAC module
  try {
    const rbacService = container.resolve(Modules.RBAC) as {
      listRbacRoles: (filters?: object) => Promise<{ id: string; name: string; description?: string }[]>
    }

    const roles = await rbacService.listRbacRoles({})
    console.log(`✅ Found ${roles.length} RBAC roles:`)
    if (roles.length === 0) {
      console.log("   ⚠️  No roles found in database!")
    } else {
      roles.forEach((role) => {
        console.log(`   - ${role.name} (${role.id})`)
        if (role.description) {
          console.log(`     Description: ${role.description}`)
        }
      })
    }
  } catch (err) {
    console.error("❌ Error accessing RBAC module:", err instanceof Error ? err.message : err)
  }

  console.log("\n")

  // Check Users
  try {
    const userService = container.resolve(Modules.USER) as {
      listUsers: (filters?: object) => Promise<{ id: string; email: string; first_name?: string; last_name?: string }[]>
    }

    const users = await userService.listUsers({})
    console.log(`✅ Found ${users.length} users:`)
    if (users.length === 0) {
      console.log("   ⚠️  No users found in database!")
    } else {
      users.forEach((user) => {
        console.log(`   - ${user.email} (${user.id})`)
        if (user.first_name || user.last_name) {
          console.log(`     Name: ${user.first_name || ""} ${user.last_name || ""}`.trim())
        }
      })
    }
  } catch (err) {
    console.error("❌ Error accessing User module:", err instanceof Error ? err.message : err)
  }

  console.log("\n")

  // Check User-Role links
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: {
        entity: string
        fields: string[]
        filters?: object
      }) => Promise<{ data: { id: string; email: string; rbac_roles?: { id: string; name: string }[] }[] }>
    }

    const { data: usersWithRoles } = await query.graph({
      entity: "user",
      fields: ["id", "email", "rbac_roles.id", "rbac_roles.name"],
    })

    console.log(`✅ Found ${usersWithRoles.length} users with role assignments:`)
    if (usersWithRoles.length === 0) {
      console.log("   ⚠️  No users with roles found!")
    } else {
      usersWithRoles.forEach((user) => {
        const roleNames = user.rbac_roles?.map((r) => r.name).join(", ") || "No roles"
        console.log(`   - ${user.email}: ${roleNames}`)
      })
    }
  } catch (err) {
    console.error("❌ Error querying user-role links:", err instanceof Error ? err.message : err)
  }

  console.log("\n✅ Database check complete!")
}
