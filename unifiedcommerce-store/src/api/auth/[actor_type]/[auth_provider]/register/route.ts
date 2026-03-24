import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"

/**
 * Custom POST /auth/:actor_type/:auth_provider/register
 *
 * When the invite page submits "create account", the admin calls this. If an auth identity
 * for that email already exists (e.g. user signed up before or a previous attempt), the
 * default flow returns 401 "Identity with email already exists". This route handles that:
 * we try login with the same email/password and, if it succeeds, return 200 with a token
 * so the invite flow can continue to accept the invite.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { actor_type, auth_provider } = req.params as { actor_type: string; auth_provider: string }
    const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
      projectConfig: { http: { jwtSecret: string; jwtExpiresIn?: string; jwtOptions?: object } }
    }
    const authService = req.scope.resolve(Modules.AUTH) as {
      register: (provider: string, data: object) => Promise<{
        success: boolean
        error?: string
        authIdentity?: object
        location?: string
      }>
      authenticate: (provider: string, data: object) => Promise<{
        success: boolean
        error?: string
        authIdentity?: object
        location?: string
      }>
    }

    const authData = {
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      protocol: req.protocol,
    }

    let result = await authService.register(auth_provider, authData)

    // If register fails because identity already exists, try login so invite flow can continue
    const errMsg = result.error ?? ""
    const isAlreadyExists =
      /identity with email already exists/i.test(errMsg) ||
      /already exists/i.test(errMsg)
    if (!result.success && isAlreadyExists && auth_provider === "emailpass") {
      const loginResult = await authService.authenticate(auth_provider, authData)
      if (loginResult.success && loginResult.authIdentity) {
        result = loginResult
      }
    }

    if (result.location) {
      return res.status(200).json({ location: result.location })
    }

    if (result.success && result.authIdentity) {
      const { http } = config.projectConfig
      const token = await generateJwtTokenForAuthIdentity(
        {
          authIdentity: result.authIdentity as any,
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
      const isSecure = req.protocol === "https"
      const cookieMaxAge = 7 * 24 * 60 * 60
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

    return res.status(401).json({
      message: result.error || "Registration failed",
    })
  } catch (err) {
    if (err instanceof MedusaError) {
      const status = err.type === MedusaError.Types.UNAUTHORIZED ? 401 : 400
      return res.status(status).json({ message: err.message })
    }
    const message = err instanceof Error ? err.message : "Registration failed. Please try again."
    return res.status(500).json({ message })
  }
}
