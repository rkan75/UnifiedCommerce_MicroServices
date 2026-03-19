import { updateUsersWorkflow } from "@medusajs/core-flows"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAuthContextFromJwtToken } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MedusaError, remoteQueryObjectFromString } from "@medusajs/framework/utils"

/** Opt out of global /admin auth so we can run our own cookie-aware auth in the handler. */
export const AUTHENTICATE = false

const COOKIE_NAME = "medusa_admin_token"

function getBearerFromRequest(req: MedusaRequest): string | undefined {
  const auth = req.headers?.authorization
  if (auth && (auth.startsWith("Bearer ") || auth.startsWith("bearer "))) {
    return auth
  }
  const cookie = (req as any).cookies?.[COOKIE_NAME]
  if (cookie) return `Bearer ${cookie}`
  const raw = (req.headers?.cookie as string) || ""
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
  if (m) {
    try {
      return `Bearer ${decodeURIComponent(m[1].trim())}`
    } catch {
      return undefined
    }
  }
  return undefined
}

function ensureAuth(req: MedusaRequest, res: MedusaResponse): boolean {
  const bearer = getBearerFromRequest(req)
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig: { http: { jwtSecret: string; jwtPublicKey?: string; jwtOptions?: object } }
  }
  const http = config?.projectConfig?.http
  const jwtOptions = http && "jwtVerifyOptions" in http ? (http as any).jwtVerifyOptions : (http as any)?.jwtOptions
  const authContext = http && bearer
    ? getAuthContextFromJwtToken(
        bearer,
        http.jwtSecret,
        ["bearer"],
        ["user"],
        http.jwtPublicKey,
        jwtOptions
      )
    : null
  if (!authContext?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return false
  }
  ;(req as any).auth_context = authContext
  return true
}

/** Normalize fields so *rbac_roles (invalid for User entity) becomes rbac_roles.id, rbac_roles.name */
function normalizeUserFields(fields: string[] | undefined): string[] {
  const defaultFields = ["id", "email", "first_name", "last_name", "avatar_url", "metadata", "created_at", "updated_at", "deleted_at", "rbac_roles.id", "rbac_roles.name"]
  if (!fields?.length) return defaultFields
  const out: string[] = []
  for (const f of fields) {
    if (f === "*rbac_roles") {
      if (!out.includes("rbac_roles.id")) out.push("rbac_roles.id")
      if (!out.includes("rbac_roles.name")) out.push("rbac_roles.name")
    } else {
      out.push(f)
    }
  }
  return out.length ? out : defaultFields
}

async function refetchUser(
  userId: string,
  scope: { resolve: (key: string) => unknown },
  fields: string[] | undefined
): Promise<Record<string, unknown> | undefined> {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (q: object) => Promise<unknown[]>
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "user",
    variables: { filters: { id: userId } },
    fields: normalizeUserFields(fields),
  })
  const users = await remoteQuery(queryObject)
  const list = Array.isArray(users) ? users : (users as { rows?: unknown[] })?.rows ?? []
  return (list[0] as Record<string, unknown>) ?? undefined
}

/**
 * GET /admin/users/:id
 * Retrieve a user by ID (needed so the admin UI can load user detail and roles; without this you get "not found").
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!ensureAuth(req, res)) return
  const { id } = req.params as { id: string }
  if (!id) {
    res.status(400).json({ message: "User ID is required" })
    return
  }
  try {
    const queryConfig = (req as any).queryConfig
    const fields = queryConfig?.fields as string[] | undefined
    const user = await refetchUser(id, req.scope, fields)
    if (!user) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `User with id: ${id} was not found`)
    }
    res.status(200).json({ user })
  } catch (err) {
    if (err instanceof MedusaError && err.type === MedusaError.Types.NOT_FOUND) {
      res.status(404).json({ message: err.message })
      return
    }
    const message = err instanceof Error ? err.message : "Failed to retrieve user"
    res.status(500).json({ message })
  }
}

/**
 * POST /admin/users/:id
 * Update a user (including role assignment). Uses Medusa updateUsersWorkflow so role updates work from the admin UI.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!ensureAuth(req, res)) return
  const { id } = req.params as { id: string }
  if (!id) {
    res.status(400).json({ message: "User ID is required" })
    return
  }
  const body = ((req as any).validatedBody ?? (req as any).body) as Record<string, unknown> | undefined
  try {
    const workflow = updateUsersWorkflow(req.scope)
    await workflow.run({
      input: {
        updates: [{ id, ...(body ?? {}) }],
      },
    })
    const queryConfig = (req as any).queryConfig
    const fields = queryConfig?.fields as string[] | undefined
    const user = await refetchUser(id, req.scope, fields)
    if (!user) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `User with id: ${id} was not found`)
    }
    res.status(200).json({ user })
  } catch (err) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as { error: (s: string, e?: unknown) => void }
    logger.error("POST /admin/users/:id failed", err)
    if (err instanceof MedusaError && err.type === MedusaError.Types.NOT_FOUND) {
      res.status(404).json({ message: err.message })
      return
    }
    const message = err instanceof Error ? err.message : "Failed to update user"
    const isNotFound =
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("does not exist")
    res.status(isNotFound ? 404 : 500).json({ message })
  }
}

/**
 * DELETE /admin/users/:id
 * Delete an admin user by ID. Auth is enforced here (cookie or Bearer) so DELETE works from the admin UI.
 * Uses User module deleteUsers so auth identities and links are handled by the module.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  if (!ensureAuth(req, res)) return
  const { id } = req.params as { id: string }
  if (!id) {
    res.status(400).json({ message: "User ID is required" })
    return
  }

  try {
    const userModule = req.scope.resolve(Modules.USER) as {
      deleteUsers: (ids: string[]) => Promise<void>
    }
    await userModule.deleteUsers([id])
    res.status(200).json({ id, object: "user", deleted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete user"
    const isNotFound =
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("does not exist")
    res.status(isNotFound ? 404 : 500).json({ message })
  }
}
