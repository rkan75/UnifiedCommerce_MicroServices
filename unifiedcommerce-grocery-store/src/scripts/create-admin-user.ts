/**
 * Creates an admin user for the store backend (email + password) and assigns
 * the "Super Admin" role if RBAC is enabled.
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/create-admin-user.ts -- email@example.com yourpassword
 *
 * With optional first/last name (env or positional):
 *   npx medusa exec ./src/scripts/create-admin-user.ts -- email@example.com yourpassword "First" "Last"
 *
 * Or with env vars (password not in shell history):
 *   ADMIN_EMAIL=admin@store.com ADMIN_PASSWORD=secret npx medusa exec ./src/scripts/create-admin-user.ts
 *
 * If the email already exists (user or auth identity), the script exits with an error.
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, FeatureFlag, Modules } from "@medusajs/framework/utils"

export default async function createAdminUser({ container, args }: ExecArgs) {
  // Medusa exec may pass args as a string ("email pass"), array ["email", "pass"], or not at all
  const raw: unknown = args ?? []
  let argv: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === "string"
      ? raw.trim().split(/\s+/)
      : []
  if (argv.length === 0 && typeof process !== "undefined" && process.argv) {
    const scriptIdx = process.argv.findIndex((a) => a.endsWith("create-admin-user.ts"))
    argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : process.argv.slice(2)
  }
  // Strip leading "--" (medusa exec passes it as first arg when you use -- email pass)
  while (argv.length > 0 && argv[0] === "--") argv.shift()
  const email = String(process.env.ADMIN_EMAIL ?? argv[0] ?? "").trim().toLowerCase()
  const password = String(process.env.ADMIN_PASSWORD ?? argv[1] ?? "")
  const firstName = String(process.env.ADMIN_FIRST_NAME ?? argv[2] ?? "").trim() || undefined
  const lastName = String(process.env.ADMIN_LAST_NAME ?? argv[3] ?? "").trim() || undefined

  if (!email || email === "--" || !email.includes("@")) {
    console.error("Usage: npx medusa exec ./src/scripts/create-admin-user.ts -- email@example.com yourpassword [first_name] [last_name]")
    console.error("   Or:  ADMIN_EMAIL=... ADMIN_PASSWORD=... npx medusa exec ./src/scripts/create-admin-user.ts")
    process.exit(1)
  }

  if (!password || password.length < 8) {
    console.error("Password is required and must be at least 8 characters.")
    process.exit(1)
  }

  const userService = container.resolve(Modules.USER) as {
    createUsers: (data: { email: string; first_name?: string; last_name?: string }) => Promise<{ id: string; email: string } | { id: string; email: string }[]>
    listUsers: (filters: { email: string }) => Promise<{ id: string }[]>
  }

  const authService = container.resolve(Modules.AUTH) as {
    register: (provider: string, data: object) => Promise<{
      success: boolean
      error?: string
      authIdentity?: { id: string }
    }>
    updateAuthIdentities: (data: { id: string; app_metadata: object }) => Promise<unknown>
  }

  // Check if user already exists (by email)
  const existingUsers = await userService.listUsers({ email })
  if (existingUsers.length > 0) {
    console.error(`A user with email ${email} already exists. Use a different email or log in.`)
    process.exit(1)
  }

  const userPayload = { email, ...(firstName && { first_name: firstName }), ...(lastName && { last_name: lastName }) }
  const created = await userService.createUsers(userPayload)
  const user = Array.isArray(created) ? created[0] : created

  // Match HTTP register payload shape so password is hashed the same way as login expects
  const result = await authService.register("emailpass", {
    url: "/auth/user/emailpass/register",
    headers: {},
    query: {},
    body: { email, password },
    protocol: "http",
  })

  if (!result.success || !result.authIdentity) {
    console.error(result.error ?? "Failed to create auth identity (e.g. email already registered).")
    process.exit(1)
  }

  await authService.updateAuthIdentities({
    id: result.authIdentity.id,
    app_metadata: { user_id: user.id },
  })

  console.log(`Admin user created: ${email} (user id: ${user.id})`)

  if (process.env.MEDUSA_FF_RBAC === "true" || FeatureFlag.isFeatureEnabled("rbac")) {
    try {
      const rbacService = container.resolve(Modules.RBAC) as {
        listRbacRoles: (filters: { name: string }) => Promise<{ id: string }[]>
      }
      const link = container.resolve(ContainerRegistrationKeys.LINK) as {
        create: (data: object[]) => Promise<unknown>
      }
      const roles = await rbacService.listRbacRoles({ name: "Super Admin" })
      if (roles.length > 0) {
        await link.create([
          {
            [Modules.USER]: { user_id: user.id },
            [Modules.RBAC]: { rbac_role_id: roles[0].id },
          },
        ])
        console.log("Assigned role: Super Admin")
      } else {
        console.log("Super Admin role not found. Run: npx medusa exec ./src/scripts/seed-rbac-roles.ts")
        console.log("Then run: npx medusa exec ./src/scripts/seed-super-admin-policies.ts")
      }
    } catch (err) {
      console.warn("Could not assign Super Admin role:", err instanceof Error ? err.message : err)
    }
  }

  console.log("")
  console.log("You can log in at your admin URL (e.g. http://localhost:9000/app) with this email and password.")
  console.log("If you get 'Invalid email or password', reset the password with:")
  console.log("  npx medusa exec ./src/scripts/reset-admin-password.ts -- " + email + " YourNewPassword")
}
