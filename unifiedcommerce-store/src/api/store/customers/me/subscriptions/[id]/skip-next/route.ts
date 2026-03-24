import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { performSkipNext } from "../../../../../../../lib/subscriptions/subscription-lifecycle"
import { assertCustomerSubscriptionAction } from "../../../../../../utils/subscription-store-action"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const gate = await assertCustomerSubscriptionAction(req)
  if (!gate.ok) {
    return res.status(gate.status).json({ message: gate.message })
  }
  const id = decodeURIComponent((req.params as { id: string }).id)
  try {
    const r = await performSkipNext(req.scope, gate.customerId, id)
    if (!r.ok) {
      return res.status(400).json({ message: r.message })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update subscription"
    return res.status(500).json({ message })
  }
}
