/**
 * Custom auth validation route — no Medusa framework outbox validation.
 * POST or GET with JWT in Authorization header or medusa_admin_token cookie.
 * Returns 200 + auth context if valid, 401 if missing/invalid/expired.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateJwtFromRequest } from "../../utils/validate-jwt"

export const AUTHENTICATE = false

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return handleValidate(req, res)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return handleValidate(req, res)
}

async function handleValidate(req: MedusaRequest, res: MedusaResponse) {
  const auth = await validateJwtFromRequest(req)
  if (!auth) {
    return res.status(401).json({
      valid: false,
      message: "Invalid or expired token.",
    })
  }
  return res.status(200).json({
    valid: true,
    actor_id: auth.actor_id,
    auth_identity_id: auth.auth_identity_id,
    actor_type: auth.actor_type,
    app_metadata: auth.app_metadata ?? {},
    user_metadata: auth.user_metadata ?? {},
  })
}
