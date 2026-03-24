import { defineMiddlewares, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { validateJwt } from "./utils/validate-jwt"
import {
  handleList as promotionHandleList,
  handleGetOne as promotionHandleGetOne,
  handleCreate as promotionHandleCreate,
  handleUpdate as promotionHandleUpdate,
  handleDelete as promotionHandleDelete,
} from "./utils/promotion-handlers"

const ADMIN_TOKEN_COOKIE = "medusa_admin_token"
const DEBUG = process.env.DEBUG_ADMIN_AUTH === "true"

function safeDecodeCookieValue(value: string): string | undefined {
  try {
    return decodeURIComponent(value.trim())
  } catch {
    return undefined
  }
}

function getCookie(req: MedusaRequest, name: string): string | undefined {
  const raw = (req as any).cookies?.[name] ?? (req.headers?.cookie as string) ?? ""
  if ((req as any).cookies?.[name]) return (req as any).cookies[name]
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? safeDecodeCookieValue(match[1]) : undefined
}

function getBearer(req: MedusaRequest): string | undefined {
  const auth = req.headers?.authorization
  if (auth && (auth.startsWith("Bearer ") || auth.startsWith("bearer "))) return auth
  const token = getCookie(req, ADMIN_TOKEN_COOKIE)
  return token ? `Bearer ${token}` : undefined
}

/**
 * Promotion route detection and dispatch.
 * Override framework promotion auth: any authenticated admin can create/read/update/delete.
 * Path can be /admin/promotions or /promotions (mounted); optional :id for get/update/delete.
 */
function getPromotionPathInfo(req: MedusaRequest): { isPromotion: boolean; id?: string; subpath?: string } {
  let pathOnly = ((req as any).url ?? (req as any).path ?? (req as any).originalUrl ?? "").toString()
  pathOnly = pathOnly.split("?")[0].trim() || ""
  // If full URL (e.g. http://localhost:9000/admin/promotions), take pathname only
  if (pathOnly.startsWith("http://") || pathOnly.startsWith("https://")) {
    try {
      pathOnly = new URL(pathOnly).pathname || pathOnly
    } catch {
      // leave pathOnly as-is
    }
  }
  pathOnly = pathOnly.replace(/\/$/, "").trim() || ""
  // Match /admin/promotions, /promotions, admin/promotions, promotions, .../promotions/123, etc.
  let match = pathOnly.match(/^(?:\/)?(?:admin\/)?promotions(?:\/([^/]+))?(?:\/(.*))?$/i)
  if (!match) {
    // Fallback: path may be relative (e.g. "promotions" when baseUrl is /admin)
    const baseUrl = ((req as any).baseUrl ?? "").toString().replace(/\/$/, "")
    const combined = baseUrl ? `${baseUrl}/${pathOnly}`.replace(/\/+/g, "/") : pathOnly
    match = combined.match(/^(?:\/)?(?:admin\/)?promotions(?:\/([^/]+))?(?:\/(.*))?$/i)
  }
  if (!match) return { isPromotion: false }
  const [, id, subpath] = match
  return { isPromotion: true, id: id || undefined, subpath: subpath || undefined }
}

/**
 * Set JWT from cookie and auth_context when present. No 401 — promotion routes bypass
 * authorization so anyone can create/update promotions; we still set auth so the
 * success page and UI see the user as logged in when the cookie is present.
 */
async function setPromotionAuthFromCookie(req: MedusaRequest): Promise<void> {
  const bearer = getBearer(req)
  if (!bearer) return
  const headers = req.headers ?? {}
  ;(headers as Record<string, string>)["authorization"] = bearer
  req.headers = headers
  if ((req as any).auth_context) return
  const authContext = validateJwt(bearer, req.scope)
  if (authContext) {
    if (!authContext.app_metadata) authContext.app_metadata = {}
    if (!authContext.user_metadata) authContext.user_metadata = {}
    ;(req as any).auth_context = authContext
  }
}

/** Dispatch promotion request to the right handler (bypasses framework RBAC; no auth required). */
async function handlePromotionRequest(req: MedusaRequest, res: MedusaResponse): Promise<boolean> {
  const { isPromotion, id, subpath } = getPromotionPathInfo(req)
  if (!isPromotion) return false
  // Subpaths like rules/batch still go to framework for now; we only override main CRUD
  if (subpath && subpath.length > 0) return false

  // Set JWT from cookie and auth_context when present (so success page sees logged-in user); never 401
  await setPromotionAuthFromCookie(req)

  // Set params for handlers that need :id
  if (id && !(req as any).params) (req as any).params = {}
  if (id) ((req as any).params as Record<string, string>).id = id

  const method = (req.method || "").toUpperCase()
  try {
    if (method === "GET" && !id) {
      await promotionHandleList(req, res)
      return true
    }
    if (method === "GET" && id) {
      await promotionHandleGetOne(req, res)
      return true
    }
    if (method === "POST" && !id) {
      await promotionHandleCreate(req, res)
      return true
    }
    if (method === "POST" && id) {
      await promotionHandleUpdate(req, res)
      return true
    }
    if (method === "DELETE" && id) {
      await promotionHandleDelete(req, res)
      return true
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const type = (err as { type?: string })?.type
    if (type === MedusaError.Types.NOT_FOUND) {
      res.status(404).json({ type: "not_found", message })
      return true
    }
    if (type === MedusaError.Types.INVALID_DATA) {
      res.status(400).json({ type: "invalid_data", message })
      return true
    }
    res.status(500).json({ type: "unknown_error", message: message || "Request failed." })
    return true
  }
  return false
}

/**
 * For /admin requests: set Authorization from cookie when missing, and set req.auth_context
 * from the JWT so that routes that opt out of auth (e.g. DELETE /admin/users/:id) still
 * have auth_context for checkPermissions (which expects auth_context.app_metadata).
 */
export default defineMiddlewares({
  routes: [
    // Run promotion override first so we never hit framework policy (promotion:undefined)
    {
      matcher: "/admin/promotions*",
      middlewares: [
        async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          const promotionHandled = await handlePromotionRequest(req, res)
          if (promotionHandled) return
          await next()
        },
      ],
    },
    {
      matcher: "/admin*",
      middlewares: [
        async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          // Also try promotion handling in case path was matched as /admin* but not /admin/promotions*
          const promotionHandled = await handlePromotionRequest(req, res)
          if (promotionHandled) return

          const bearer = getBearer(req)
          if (!bearer) {
            if (DEBUG) console.log("[admin-auth] No Authorization and no medusa_admin_token cookie")
            return next()
          }
          const headers = req.headers ?? {}
          ;(headers as Record<string, string>)["authorization"] = bearer
          req.headers = headers
          if (DEBUG) console.log("[admin-auth] Set Authorization from cookie/header")

          if (!(req as any).auth_context) {
            const authContext = validateJwt(bearer, req.scope)
            if (authContext) {
              if (!authContext.app_metadata) authContext.app_metadata = {}
              if (!authContext.user_metadata) authContext.user_metadata = {}
              ;(req as any).auth_context = authContext
              if (DEBUG) console.log("[admin-auth] Set auth_context from JWT")
            }
          }

          // RBAC: Framework auth runs before us and sets auth_context from JWT (which often has no roles).
          // So we must always ensure app_metadata.roles is filled from DB when missing/empty.
          const authContext = (req as any).auth_context
          if (authContext?.actor_id) {
            const roleIds = (authContext.app_metadata?.roles as string[] | undefined)
            if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
              let roles: { id: string }[] = []
              try {
                const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
                  graph: (args: {
                    entity: string
                    fields: string[]
                    filters?: { id: string }
                  }) => Promise<{ data: { id?: string; rbac_roles?: { id: string }[] }[] }>
                }
                let data = (await query.graph({
                  entity: "user",
                  fields: ["id", "rbac_roles.id"],
                  filters: { id: authContext.actor_id },
                }))?.data
                if (data?.[0]) {
                  roles = data[0].rbac_roles ?? []
                }
                if (roles.length === 0) {
                  const all = (await query.graph({
                    entity: "user",
                    fields: ["id", "rbac_roles.id"],
                  }))?.data ?? []
                  const user = all.find((u) => u.id === authContext.actor_id)
                  roles = user?.rbac_roles ?? []
                }
                if (!authContext.app_metadata) authContext.app_metadata = {}
                authContext.app_metadata.roles = roles.map((r) => r.id)
                if (DEBUG || authContext.app_metadata.roles.length > 0) {
                  console.log("[admin-auth] app_metadata.roles from DB:", authContext.app_metadata.roles.length, "role(s)")
                }
              } catch (e) {
                console.warn("[admin-auth] Failed to load roles from DB:", (e as Error).message)
              }
            }
          }
          next()
        },
      ],
    },
  ],
})
