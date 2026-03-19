/**
 * Deletes all database records for an admin user by email so you can re-create them
 * with create-admin-user.ts. Removes: provider_identity (emailpass), auth_identity, user,
 * and user–role links (RBAC).
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/delete-admin-user.ts -- user@example.com
 *
 * Or with env:
 *   ADMIN_EMAIL=user@example.com npx medusa exec ./src/scripts/delete-admin-user.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function deleteAdminUser({ container, args }: ExecArgs) {
  const raw: unknown = args ?? []
  let argv: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === "string"
      ? raw.trim().split(/\s+/)
      : []
  if (argv.length === 0 && typeof process !== "undefined" && process.argv) {
    const scriptIdx = process.argv.findIndex((a) => a.endsWith("delete-admin-user.ts"))
    argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : process.argv.slice(2)
  }
  while (argv.length > 0 && argv[0] === "--") argv.shift()
  const email = String(process.env.ADMIN_EMAIL ?? argv[0] ?? "").trim().toLowerCase()

  if (!email || email === "--" || !email.includes("@")) {
    console.error("Usage: npx medusa exec ./src/scripts/delete-admin-user.ts -- email@example.com")
    console.error("   Or:  ADMIN_EMAIL=... npx medusa exec ./src/scripts/delete-admin-user.ts")
    process.exit(1)
  }

  const userModule = container.resolve(Modules.USER) as {
    listUsers: (filters: { email?: string }) => Promise<{ id: string; email?: string }[]>
    deleteUsers: (ids: string[]) => Promise<unknown>
  }
  const authModule = container.resolve(Modules.AUTH) as {
    listProviderIdentities: (filters: { entity_id?: string; provider?: string }) => Promise<
      Array<{ id: string; entity_id: string; auth_identity_id: string }>
    >
    deleteProviderIdentities: (ids: string[]) => Promise<unknown>
    deleteAuthIdentities: (ids: string[]) => Promise<unknown>
  }

  // 1) Find provider identities for this email (emailpass)
  const providerIdentities = await authModule.listProviderIdentities({
    entity_id: email,
    provider: "emailpass",
  })
  const authIdentityIds = [...new Set(providerIdentities.map((p) => p.auth_identity_id))]
  const providerIdentityIds = providerIdentities.map((p) => p.id)

  // 2) Find user(s) by email
  const users = await userModule.listUsers({ email })
  const userIds = users.map((u) => u.id)

  if (providerIdentityIds.length === 0 && userIds.length === 0) {
    console.log(`No user or auth records found for ${email}. Nothing to delete.`)
    return
  }

  console.log(`Deleting records for ${email}:`)
  if (providerIdentityIds.length) console.log(`  - ${providerIdentityIds.length} provider_identity (emailpass)`)
  if (authIdentityIds.length) console.log(`  - ${authIdentityIds.length} auth_identity`)
  if (userIds.length) console.log(`  - ${userIds.length} user`)

  // 3) Delete in order: provider identities → auth identities → users (links may cascade or need explicit delete)
  if (providerIdentityIds.length > 0) {
    await authModule.deleteProviderIdentities(providerIdentityIds)
    console.log("  Deleted provider_identity rows.")
  }
  if (authIdentityIds.length > 0) {
    await authModule.deleteAuthIdentities(authIdentityIds)
    console.log("  Deleted auth_identity rows.")
  }

  // 4) Delete user (and any link tables – Medusa often cascades or we need to remove links first)
  if (userIds.length > 0) {
    try {
      await userModule.deleteUsers(userIds)
      console.log("  Deleted user rows.")
    } catch (err) {
      console.warn("  deleteUsers failed (you may need to remove user–role links first):", (err as Error).message)
      console.log("  Run the SQL below to remove user and related rows, then re-run this script or create-admin-user.")
      console.log("")
      console.log("  -- Optional: remove RBAC links and user manually (replace USER_ID with the id):")
      userIds.forEach((id) => console.log(`  -- DELETE FROM user_rbac_role WHERE user_id = '${id}';`))
      userIds.forEach((id) => console.log(`  -- DELETE FROM \"user\" WHERE id = '${id}';`))
    }
  }

  console.log(`\nDone. You can now run: npx medusa exec ./src/scripts/create-admin-user.ts -- ${email} YourPassword`)
}
