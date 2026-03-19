/**
 * Local helpers for product/variant API responses.
 * Mirrors @medusajs/medusa admin product helpers so we don't depend on
 * internal dist paths (which break under the API route loader).
 */

const isPricing = (fieldName: string) =>
  fieldName.startsWith("variants.prices") ||
  fieldName.startsWith("*variants.prices") ||
  fieldName.startsWith("prices") ||
  fieldName.startsWith("*prices")

export function remapKeysForProduct(selectFields: string[]): string[] {
  const productFields = selectFields.filter((fieldName) => !isPricing(fieldName))
  const pricingFields = selectFields
    .filter((fieldName) => isPricing(fieldName))
    .map((fieldName) => fieldName.replace("variants.prices.", "variants.price_set.prices."))
  return [...productFields, ...pricingFields]
}

export function remapKeysForVariant(selectFields: string[]): string[] {
  const variantFields = selectFields.filter((fieldName) => !isPricing(fieldName))
  const pricingFields = selectFields
    .filter((fieldName) => isPricing(fieldName))
    .map((fieldName) => fieldName.replace("prices.", "price_set.prices."))
  return [...variantFields, ...pricingFields]
}

function buildRules(price: { price_rules?: Array<{ attribute?: string; value?: string }> }): Record<string, string> {
  const rules: Record<string, string> = {}
  for (const priceRule of price.price_rules || []) {
    const ruleAttribute = priceRule.attribute
    if (ruleAttribute) {
      rules[ruleAttribute] = priceRule.value ?? ""
    }
  }
  return rules
}

export function remapVariantResponse(variant: any): any {
  if (!variant) return variant
  const resp = {
    ...variant,
    prices: variant.price_set?.prices?.map((price: any) => ({
      id: price.id,
      amount: price.amount,
      currency_code: price.currency_code,
      min_quantity: price.min_quantity,
      max_quantity: price.max_quantity,
      variant_id: variant.id,
      created_at: price.created_at,
      updated_at: price.updated_at,
      rules: buildRules(price),
    })),
  }
  delete resp.price_set
  return resp
}

export function remapProductResponse(product: any): any {
  return {
    ...product,
    variants: product.variants?.map(remapVariantResponse),
  }
}

/**
 * Refetch created/updated variants after batch workflow (for API response).
 */
export async function refetchBatchVariants(
  batchResult: { created: { id: string }[]; updated: { id: string }[]; deleted: string[] },
  scope: { resolve: (key: string) => any },
  fields: string[] | undefined
): Promise<{ created: any[]; updated: any[]; deleted: { ids: string[]; object: string; deleted: boolean } }> {
  const { ContainerRegistrationKeys, remoteQueryObjectFromString, promiseAll } = await import(
    "@medusajs/framework/utils"
  )
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  let created: Promise<any[]> = Promise.resolve([])
  let updated: Promise<any[]> = Promise.resolve([])
  if (batchResult.created?.length) {
    const createdQuery = remoteQueryObjectFromString({
      entryPoint: "variant",
      variables: { filters: { id: batchResult.created.map((v) => v.id) } },
      fields: remapKeysForVariant(fields ?? []),
    })
    created = remoteQuery(createdQuery)
  }
  if (batchResult.updated?.length) {
    const updatedQuery = remoteQueryObjectFromString({
      entryPoint: "variant",
      variables: { filters: { id: batchResult.updated.map((v) => v.id) } },
      fields: remapKeysForVariant(fields ?? []),
    })
    updated = remoteQuery(updatedQuery)
  }
  const [createdRes, updatedRes] = await promiseAll([created, updated])
  return {
    created: createdRes,
    updated: updatedRes,
    deleted: { ids: batchResult.deleted ?? [], object: "variant", deleted: true },
  }
}
