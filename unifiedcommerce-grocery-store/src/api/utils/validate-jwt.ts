/**
 * Custom JWT validation — no Medusa framework outbox or framework auth pipeline.
 * Verifies the token with the project's JWT secret and returns a plain auth context.
 */

import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"

export type ValidatedAuthContext = {
  actor_id: string
  auth_identity_id: string
  actor_type: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

const COOKIE_NAME = "medusa_admin_token"

function getTokenFromRequest(req: MedusaRequest): string | undefined {
  const auth = (req.headers?.authorization ?? "") as string
  if (auth && (auth.startsWith("Bearer ") || auth.startsWith("bearer "))) {
    return auth.slice(7).trim()
  }
  const raw = (req as any).cookies?.[COOKIE_NAME] ?? (req.headers?.cookie as string) ?? ""
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
  if (match) {
    try {
      return decodeURIComponent(match[1].trim())
    } catch {
      return undefined
    }
  }
  return undefined
}

type Scope = { resolve: (key: string) => unknown }

/**
 * Validate a raw JWT (e.g. "Bearer <token>" or "<token>") and return auth context.
 * Does not use Medusa's getAuthContextFromJwtToken or outbox.
 */
export function validateJwt(bearerOrToken: string, scope: Scope): ValidatedAuthContext | null {
  const token = bearerOrToken.startsWith("Bearer ") || bearerOrToken.startsWith("bearer ")
    ? bearerOrToken.slice(7).trim()
    : bearerOrToken.trim()
  if (!token) return null

  const config = scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig?: { http?: { jwtSecret?: string; jwtPublicKey?: string; algorithms?: string[] } }
  }
  const http = config?.projectConfig?.http
  const secret = http?.jwtSecret
  if (!secret) return null

  try {
    const options: jwt.VerifyOptions = {
      algorithms: (http as any)?.algorithms ?? ["HS256"],
      ignoreExpiration: false,
    }
    const decoded = jwt.verify(token, secret, options) as Record<string, unknown>
    const actorId = decoded.actor_id as string | undefined
    const authIdentityId = decoded.auth_identity_id as string | undefined
    const actorType = (decoded.actor_type as string) ?? "user"
    if (!authIdentityId) return null
    return {
      actor_id: actorId ?? authIdentityId,
      auth_identity_id: authIdentityId,
      actor_type: actorType,
      app_metadata: (decoded.app_metadata as Record<string, unknown>) ?? {},
      user_metadata: (decoded.user_metadata as Record<string, unknown>) ?? {},
    }
  } catch {
    return null
  }
}

/**
 * Validate JWT from request (cookie or Authorization header). No framework outbox.
 */
export async function validateJwtFromRequest(req: MedusaRequest): Promise<ValidatedAuthContext | null> {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return validateJwt(`Bearer ${token}`, req.scope)
}

/**
 * Get bearer string for passing to other handlers (e.g. set Authorization header).
 */
export function getBearerFromRequest(req: MedusaRequest): string | undefined {
  const token = getTokenFromRequest(req)
  return token ? `Bearer ${token}` : undefined
}
