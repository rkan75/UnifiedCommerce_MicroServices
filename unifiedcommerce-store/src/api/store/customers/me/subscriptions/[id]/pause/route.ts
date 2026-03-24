import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { performPause } from "../../../../../../../lib/subscriptions/subscription-lifecycle"
import { assertCustomerSubscriptionAction } from "../../../../../../utils/subscription-store-action"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const gate = await assertCustomerSubscriptionAction(req)
  if (!gate.ok) {
    return res.status(gate.status).json({ message: gate.message })
  }
  const id = (req.params as { id: string }).id
  const r = await performPause(req.scope, gate.customerId, id)
  if (!r.ok) {
    return res.status(400).json({ message: r.message })
  }
  return res.status(200).json({ ok: true })
}
