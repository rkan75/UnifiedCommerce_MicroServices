import type { AuthContext } from "@medusajs/framework/http"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { buildCustomerSubscriptions } from "../../../../../lib/subscriptions/build-customer-subscriptions"
import { validateJwtFromRequest } from "../../../../utils/validate-jwt"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth =
    (req as MedusaRequest & { auth_context?: AuthContext }).auth_context ??
    (await validateJwtFromRequest(req))

  if (!auth || auth.actor_type !== "customer" || !auth.actor_id) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const subscriptions = await buildCustomerSubscriptions(req.scope, auth.actor_id)
  return res.status(200).json({ subscriptions })
}
