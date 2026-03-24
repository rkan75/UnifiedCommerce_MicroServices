/**
 * One-off: set the store name to "UnifiedCommerce Store" (used as admin dashboard title).
 * Run: npx medusa exec ./src/scripts/set-store-name.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"

const STORE_NAME = "UnifiedCommerce Store"

export default async function setStoreName({ container }: ExecArgs) {
  const storeModule = container.resolve(Modules.STORE) as {
    listStores: (filters?: object) => Promise<{ id: string; name?: string }[]>
  }
  const [store] = await storeModule.listStores()
  if (!store) {
    console.log("No store found.")
    return
  }
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { name: STORE_NAME },
    },
  })
  console.log(`Store name set to "${STORE_NAME}". Admin dashboard title will update after refresh.`)
}
