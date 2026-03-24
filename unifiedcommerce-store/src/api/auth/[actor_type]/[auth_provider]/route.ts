import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"

const DEBUG_AUTH = process.env.DEBUG_AUTH !== "false" // set DEBUG_AUTH=false to disable

function debugLog(msg: string, data?: Record<string, unknown>) {
  if (DEBUG_AUTH) {
    const payload = data ? ` ${JSON.stringify(data)}` : ""
    console.log(`[auth/login]${payload} ${msg}`)
  }
}

/**
 * Custom GET/POST /auth/:actor_type/:auth_provider (login).
 * Adds debug logging for login and password retrieval.
 */
async function handleAuthenticate(req: MedusaRequest, res: MedusaResponse) {
  const { actor_type, auth_provider } = req.params as { actor_type: string; auth_provider: string }
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig: { http: { jwtSecret: string; jwtExpiresIn?: string; jwtOptions?: object } }
  }
  const service = req.scope.resolve(Modules.AUTH) as {
    authenticate: (provider: string, data: object) => Promise<{
      success: boolean
      error?: string
      authIdentity?: object
      location?: string
    }>
    listProviderIdentities: (
      filters: { entity_id?: string; provider?: string }
    ) => Promise<Array<{ id: string; entity_id: string; provider_metadata?: Record<string, unknown> }>>
  }

  const body = (req.body || {}) as { email?: string; password?: string }
  const email = body.email ?? "(missing)"
  debugLog("Login attempt", {
    actor_type,
    auth_provider,
    email: email === "(missing)" ? email : `${String(email).slice(0, 3)}***@***`,
    hasPassword: !!body.password,
  })

  // Debug: before authenticate, check what we have in DB for this email (emailpass only)
  if (auth_provider === "emailpass" && body.email) {
    try {
      const identities = await service.listProviderIdentities({
        entity_id: body.email,
        provider: auth_provider,
      })
      const first = identities[0]
      debugLog("Password retrieval (provider_identity lookup)", {
        entity_id: body.email,
        found: identities.length,
        providerIdentityId: first?.id ?? null,
        hasPasswordInMetadata: !!(first?.provider_metadata && "password" in (first.provider_metadata || {})),
        hint: identities.length === 0 ? "No row for this email - check exact spelling/case or run password reset" : undefined,
      })
    } catch (e) {
      debugLog("Password retrieval lookup error", { error: (e as Error).message })
    }
  }

  const authData = {
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    protocol: req.protocol,
  }

  let result = await service.authenticate(auth_provider, authData)

  // If login fails for emailpass, retry with lowercase email (handles case mismatch)
  if (
    auth_provider === "emailpass" &&
    !result.success &&
    body.email &&
    body.email !== body.email.toLowerCase()
  ) {
    debugLog("Login retry with lowercase email", { email: `${String(body.email).slice(0, 3)}***@***` })
    const lowerBody = { ...body, email: body.email.toLowerCase() }
    result = await service.authenticate(auth_provider, {
      ...authData,
      body: lowerBody,
    })
  }

  // If still failing, try case-insensitive lookup (e.g. after password reset when DB has different casing)
  if (auth_provider === "emailpass" && !result.success && body.email && body.password) {
    try {
      const allIdentities = await service.listProviderIdentities({ provider: auth_provider })
      const canonicalEmail = body.email.trim().toLowerCase()
      const match = allIdentities.find(
        (p) => p.entity_id.trim().toLowerCase() === canonicalEmail
      )
      if (match && match.entity_id !== body.email) {
        debugLog("Login retry with canonical entity_id (case-insensitive match)")
        result = await service.authenticate(auth_provider, {
          ...authData,
          body: { ...body, email: match.entity_id },
        })
      }
    } catch (e) {
      debugLog("Case-insensitive login fallback error", { error: (e as Error).message })
    }
  }

  const { success, error, authIdentity, location } = result

  if (location) {
    debugLog("Login redirect", { location })
    return res.status(200).json({ location })
  }

  if (success && authIdentity) {
    debugLog("Login success", { email: email === "(missing)" ? email : `${String(email).slice(0, 3)}***@***` })
    const { http } = config.projectConfig
    const token = await generateJwtTokenForAuthIdentity(
      {
        authIdentity: authIdentity as any,
        actorType: actor_type,
        authProvider: auth_provider,
        container: req.scope,
      },
      {
        secret: http.jwtSecret,
        expiresIn: http.jwtExpiresIn,
        options: http.jwtOptions,
      }
    )
    // Set cookie so admin requests that don't send Authorization header still get auth (middleware copies cookie → header)
    const isSecure = req.protocol === "https"
    const cookieMaxAge = 7 * 24 * 60 * 60 // 7 days
    const cookieValue = encodeURIComponent(token)
    const cookieParts = [
      `medusa_admin_token=${cookieValue}`,
      `Path=/`,
      `Max-Age=${cookieMaxAge}`,
      `SameSite=Lax`,
      `HttpOnly`,
      ...(isSecure ? ["Secure"] : []),
    ]
    res.setHeader("Set-Cookie", cookieParts.join("; "))
    return res.status(200).json({ token })
  }

  debugLog("Login failed", { email: body.email ?? "(missing)", error: error ?? "Authentication failed" })
  throw new MedusaError(
    MedusaError.Types.UNAUTHORIZED,
    error || "Authentication failed"
  )
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return handleAuthenticate(req, res)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return handleAuthenticate(req, res)
}
