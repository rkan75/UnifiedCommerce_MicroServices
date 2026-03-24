import type { AuthContext, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { validateJwtFromRequest } from "./validate-jwt"

export async function assertCustomerSubscriptionAction(
  req: MedusaRequest
): Promise<{ ok: true; customerId: string } | { ok: false; status: number; message: string }> {
  const auth =
    (req as MedusaRequest & { auth_context?: AuthContext }).auth_context ??
    (await validateJwtFromRequest(req))

  if (!auth || auth.actor_type !== "customer" || !auth.actor_id) {
    return { ok: false, status: 401, message: "Unauthorized" }
  }

  const rawId = (req.params as { id?: string })?.id
  if (!rawId?.length) {
    return { ok: false, status: 400, message: "Missing subscription id" }
  }

  if (rawId.startsWith("csub_")) {
    return {
      ok: false,
      status: 400,
      message:
        "This refill is still tied to your cart. Complete checkout to activate subscription management.",
    }
  }

  if (!rawId.startsWith("osub_")) {
    return { ok: false, status: 400, message: "Unknown subscription id" }
  }

  return { ok: true, customerId: auth.actor_id }
}
