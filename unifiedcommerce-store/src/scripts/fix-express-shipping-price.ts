/**
 * One-off / maintenance: set flat-rate USD price for shipping options whose name contains "Express".
 * Default matches storefront scheduled delivery fee ($9.99 = 999 minor units).
 *
 * Run from unifiedcommerce-store:
 *   npx medusa exec ./src/scripts/fix-express-shipping-price.ts
 *
 * Override cents (optional): MEDUSA_EXPRESS_SHIPPING_USD_MINOR=999
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { updateShippingOptionsWorkflow } from "@medusajs/core-flows"
import { Modules } from "@medusajs/utils"

const DEFAULT_USD_MINOR = 999

export default async function fixExpressShippingPrice({ container }: ExecArgs) {
  const minor = (() => {
    const raw = process.env.MEDUSA_EXPRESS_SHIPPING_USD_MINOR?.trim()
    if (!raw) return DEFAULT_USD_MINOR
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_USD_MINOR
  })()

  const fulfillment = container.resolve(Modules.FULFILLMENT) as {
    listShippingOptions: (
      filters: Record<string, unknown>,
      config?: { select?: string[] }
    ) => Promise<
      Array<{
        id: string
        name?: string | null
        price_type?: string | null
      }>
    >
  }

  const options = await fulfillment.listShippingOptions({})
  const targets = options.filter((o) => /express/i.test(o.name ?? ""))

  if (!targets.length) {
    console.log("No shipping option with 'Express' in the name found.")
    return
  }

  const workflow = updateShippingOptionsWorkflow(container)

  for (const opt of targets) {
    if (String(opt.price_type ?? "").toLowerCase() === "calculated") {
      console.warn(
        `Skipping "${opt.name}" (${opt.id}): price_type is calculated. Change in Admin or adjust the fulfillment provider.`
      )
      continue
    }

    await workflow.run({
      input: [
        {
          id: opt.id,
          prices: [{ amount: minor, currency_code: "usd" }],
        },
      ],
    })
    console.log(
      `Updated "${opt.name}" (${opt.id}) → $${(minor / 100).toFixed(2)} USD (${minor} minor units).`
    )
  }
}
