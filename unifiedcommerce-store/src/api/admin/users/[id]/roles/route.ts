/**
 * POST /admin/users/:id/roles
 * Set roles for a user (replaces existing role assignments).
 * Body: { role_ids: string[] }
 * Uses Link module to dismiss existing user–role links and create new ones.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAuthContextFromJwtToken } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MedusaError, remoteQueryObjectFromString } from "@medusajs/framework/utils"

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

async function getUserWithRoles(
  userId: string,
  scope: { resolve: (key: string) => unknown }
): Promise<{ id: string; rbac_roles?: { id: string }[] } | undefined> {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (q: object) => Promise<unknown[]>
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "user",
    variables: { filters: { id: userId } },
    fields: ["id", "rbac_roles.id"],
  })
  const users = await remoteQuery(queryObject)
  const list = Array.isArray(users) ? users : (users as { rows?: unknown[] })?.rows ?? []
  return (list[0] as { id: string; rbac_roles?: { id: string }[] }) ?? undefined
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as { info: (s: string) => void; error: (s: string, e?: unknown) => void }
  if (!ensureAuth(req, res)) return
  const { id: userId } = req.params as { id: string }
  if (!userId) {
    logger.error("POST /admin/users/:id/roles: missing user id")
    res.status(400).json({ message: "User ID is required" })
    return
  }

  let roleIds: string[] = []
  try {
    const body = ((req as any).validatedBody ?? (req as any).body) as { role_ids?: string[] } | undefined
    roleIds = Array.isArray(body?.role_ids) ? body.role_ids : []
  } catch (e) {
    logger.error("POST /admin/users/:id/roles: invalid body", e)
    res.status(400).json({ message: "Invalid body; expected { role_ids: string[] }" })
    return
  }

  try {
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as unknown as {
      create: (data: object[]) => Promise<unknown[]>
      dismiss: (data: object) => Promise<void>
    }

    const user = await getUserWithRoles(userId, req.scope)
    if (!user) {
      logger.error(`POST /admin/users/:id/roles: user not found: ${userId}`)
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `User with id ${userId} was not found`)
    }

    const existingRoles = user.rbac_roles ?? []
    for (const role of existingRoles) {
      if (!role?.id) continue
      try {
        await link.dismiss({
          [Modules.USER]: { user_id: userId },
          [Modules.RBAC]: { rbac_role_id: role.id },
        })
      } catch (dismissErr) {
        logger.error(`POST /admin/users/:id/roles: dismiss link failed for user ${userId} role ${role.id}`, dismissErr)
      }
    }

    for (const roleId of roleIds) {
      if (!roleId) continue
      await link.create([
        {
          [Modules.USER]: { user_id: userId },
          [Modules.RBAC]: { rbac_role_id: roleId },
        },
      ])
    }

    logger.info(`POST /admin/users/:id/roles: updated roles for user ${userId} to [${roleIds.join(", ")}]`)
    res.status(200).json({ user_id: userId, role_ids: roleIds })
  } catch (err) {
    if (err instanceof MedusaError && err.type === MedusaError.Types.NOT_FOUND) {
      logger.error(`POST /admin/users/:id/roles: not found - ${err.message}`)
      res.status(404).json({ message: err.message })
      return
    }
    const message = err instanceof Error ? err.message : "Failed to set user roles"
    logger.error(`POST /admin/users/:id/roles: ${message}`, err)
    const isNotFound =
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("does not exist")
    res.status(isNotFound ? 404 : 500).json({ message })
  }
}
