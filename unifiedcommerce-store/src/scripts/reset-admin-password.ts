/**
 * Resets the password for an existing admin user (email/password auth).
 * Use this if you created a user with create-admin-user.ts but cannot log in
 * (e.g. "Invalid email or password" — often due to shell escaping or wrong password at creation).
 *
 * Usage (from backend root):
 *   npx medusa exec ./src/scripts/reset-admin-password.ts -- kannan.ramakrishnan@tcs.com YourNewPassword123
 *
 * Or with env vars (password not in shell history):
 *   ADMIN_EMAIL=kannan.ramakrishnan@tcs.com ADMIN_PASSWORD=YourNewPassword123 npx medusa exec ./src/scripts/reset-admin-password.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function resetAdminPassword({ container, args }: ExecArgs) {
  const raw: unknown = args ?? []
  let argv: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === "string"
      ? raw.trim().split(/\s+/)
      : []
  if (argv.length === 0 && typeof process !== "undefined" && process.argv) {
    const scriptIdx = process.argv.findIndex((a) => a.endsWith("reset-admin-password.ts"))
    argv = scriptIdx >= 0 ? process.argv.slice(scriptIdx + 1) : process.argv.slice(2)
  }
  while (argv.length > 0 && argv[0] === "--") argv.shift()
  const email = String(process.env.ADMIN_EMAIL ?? argv[0] ?? "").trim().toLowerCase()
  const password = String(process.env.ADMIN_PASSWORD ?? argv[1] ?? "")

  if (!email) {
    console.error("Usage: npx medusa exec ./src/scripts/reset-admin-password.ts -- email@example.com newpassword")
    console.error("   Or:  ADMIN_EMAIL=... ADMIN_PASSWORD=... npx medusa exec ./src/scripts/reset-admin-password.ts")
    process.exit(1)
  }

  if (!password || password.length < 8) {
    console.error("Password is required and must be at least 8 characters.")
    process.exit(1)
  }

  const authService = container.resolve(Modules.AUTH) as {
    updateProvider: (
      provider: string,
      data: { entity_id: string; password: string }
    ) => Promise<{ success: boolean; error?: string }>
  }

  const result = await authService.updateProvider("emailpass", {
    entity_id: email,
    password,
  })

  if (!result.success) {
    console.error(result.error ?? "Failed to update password. Check that the email has an existing admin (emailpass) account.")
    process.exit(1)
  }

  console.log(`Password updated for ${email}. You can log in with the new password.`)
}
