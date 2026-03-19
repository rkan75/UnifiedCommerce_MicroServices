/**
 * One-time fix for a user who cannot log in due to email case mismatch.
 * Normalizes provider_identity.entity_id to lowercase for emailpass so login
 * works with any casing (e.g. rkan75@gmail.com).
 *
 * Usage:
 *   npx medusa exec ./src/scripts/normalize-auth-email-to-lowercase.ts
 *   npx medusa exec ./src/scripts/normalize-auth-email-to-lowercase.ts -- email=rkan75@gmail.com
 *
 * Without -- email=... normalizes all emailpass provider identities where entity_id has uppercase.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

function parseExecOptions(args: unknown): Record<string, string> {
  if (args && typeof args === "object" && !Array.isArray(args)) return args as Record<string, string>
  const arr = Array.isArray(args) ? args : typeof args === "string" ? args.split(/\s+/) : []
  const out: Record<string, string> = {}
  for (const s of arr) {
    if (typeof s === "string" && s.includes("=")) {
      const [k, ...v] = s.split("=")
      if (k) out[k.trim()] = v.join("=").trim()
    }
  }
  return out
}

export default async function normalizeAuthEmailToLowercase({
  container,
  args,
}: ExecArgs) {
  const options = parseExecOptions(args ?? [])
  const emailArg = options.email
  const authModule = container.resolve(Modules.AUTH) as {
    listProviderIdentities: (filters: {
      provider?: string
      entity_id?: string
    }) => Promise<Array<{ id: string; entity_id: string; provider: string }>>
    updateProviderIdentities: (data: Array<{
      id: string
      entity_id?: string
    }>) => Promise<unknown>
  }

  const list = await authModule.listProviderIdentities({ provider: "emailpass" })
  const toNormalize = list.filter((p) => {
    if (p.entity_id === p.entity_id.toLowerCase()) return false
    if (emailArg && p.entity_id.toLowerCase() !== emailArg.toLowerCase()) return false
    return true
  })

  if (toNormalize.length === 0) {
    console.log(
      emailArg
        ? `No provider_identity found for "${emailArg}" that needs normalizing (or already lowercase).`
        : "No emailpass provider identities need normalizing (all already lowercase)."
    )
    return
  }

  console.log(`Normalizing entity_id to lowercase for ${toNormalize.length} identity/identities:`)
  for (const p of toNormalize) {
    console.log(`  ${p.entity_id} → ${p.entity_id.toLowerCase()} (id: ${p.id})`)
  }

  await authModule.updateProviderIdentities(
    toNormalize.map((p) => ({
      id: p.id,
      entity_id: p.entity_id.toLowerCase(),
    }))
  )
  console.log("Done. The user can now log in with the email in any casing.")
}
