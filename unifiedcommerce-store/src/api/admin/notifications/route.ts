import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAuthContextFromJwtToken, refetchEntities } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Opt out of default auth so we can use cookie-aware auth (admin UI sends cookie, not always Bearer). */
export const AUTHENTICATE = false

const COOKIE_NAME = "medusa_admin_token"

function getBearerFromRequest(req: MedusaRequest): string | undefined {
  const auth = req.headers?.authorization
  if (auth && (auth.startsWith("Bearer ") || auth.startsWith("bearer "))) return auth
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
    ? getAuthContextFromJwtToken(bearer, http.jwtSecret, ["bearer"], ["user"], http.jwtPublicKey, jwtOptions)
    : null
  if (!authContext?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return false
  }
  ;(req as any).auth_context = authContext
  return true
}

/**
 * In-memory cache for notification list to reduce DB load from dashboard polling (every 60s).
 * Set NOTIFICATIONS_CACHE_TTL_MS in env (milliseconds) to override; set to 0 to disable cache.
 */
const NOTIFICATIONS_CACHE_TTL_MS = Math.max(
  0,
  typeof process.env.NOTIFICATIONS_CACHE_TTL_MS !== "undefined"
    ? parseInt(process.env.NOTIFICATIONS_CACHE_TTL_MS, 10)
    : 45_000
)
const listCache = new Map<string, { payload: NotificationsPayload; expiresAt: number }>()
const CACHE_MAX_ENTRIES = 20

type NotificationsPayload = {
  notifications: Record<string, unknown>[]
  count: number
  offset: number
  limit: number
}

function getCacheKey(filters: Record<string, unknown>, fields: string[] | undefined, take: number, skip: number): string {
  return JSON.stringify({ filters, fields, take, skip })
}

function getCached(key: string): NotificationsPayload | null {
  const entry = listCache.get(key)
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) listCache.delete(key)
    return null
  }
  return entry.payload
}

function setCache(key: string, payload: NotificationsPayload): void {
  listCache.set(key, { payload, expiresAt: Date.now() + NOTIFICATIONS_CACHE_TTL_MS })
  if (listCache.size > CACHE_MAX_ENTRIES) {
    const keysToDelete = [...listCache.keys()].slice(0, listCache.size - CACHE_MAX_ENTRIES)
    keysToDelete.forEach((k) => listCache.delete(k))
  }
}

/**
 * Optimized GET /admin/notifications
 *
 * - Caches the response for 45 seconds to avoid exhausting the connection pool when
 *   the dashboard polls every 60 seconds (only one DB query per 45s per unique request).
 * - Uses refetchEntities in a single short-lived call so the connection is released promptly.
 *
 * Response shape matches the default route so the admin UI continues to work.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!ensureAuth(req, res)) return
  const filterableFields = (req.filterableFields ?? {}) as Record<string, unknown>
  const queryConfig = (req as { queryConfig?: { fields?: string[]; pagination?: { take?: number; skip?: number } } }).queryConfig ?? {}
  const fields = queryConfig.fields
  const pagination = queryConfig.pagination ?? {}
  const take = Math.min(Math.max(1, pagination.take ?? 50), 50)
  const skip = Math.max(0, pagination.skip ?? 0)

  const cacheKey = getCacheKey(filterableFields, fields, take, skip)
  if (NOTIFICATIONS_CACHE_TTL_MS > 0) {
    const cached = getCached(cacheKey)
    if (cached) return res.json(cached)
  }

  const { data: notifications, metadata } = await refetchEntities({
    entity: "notification",
    idOrFilter: filterableFields,
    scope: req.scope,
    fields: fields ?? [],
    pagination: { take, skip },
  })

  const payload: NotificationsPayload = {
    notifications: (Array.isArray(notifications) ? notifications : [notifications]) as Record<string, unknown>[],
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? skip,
    limit: metadata?.take ?? take,
  }
  if (NOTIFICATIONS_CACHE_TTL_MS > 0) setCache(cacheKey, payload)
  return res.json(payload)
}
