/**
 * Dynamic delivery fulfillment provider: delivery fee = % of order value.
 * - Order value >= $50: 5% delivery fee
 * - Order value < $50: 10% delivery fee
 * Supports delivery slot and pickup slot (same fee rules; slot is the shipping option type).
 */
import {
  AbstractFulfillmentProviderService,
  ModuleProvider,
  Modules,
} from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  FulfillmentOption,
} from "@medusajs/types"

const ORDER_VALUE_THRESHOLD_CENTS = 5000 // $50
const FEE_PCT_ABOVE_THRESHOLD = 5
const FEE_PCT_BELOW_THRESHOLD = 10

/** Normalize to cents. Medusa may pass amounts in minor units (cents) or in major (dollars). */
function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value % 1 !== 0) return Math.round(value * 100) // decimal => dollars (e.g. 9.94)
  if (value < 100) return value * 100 // e.g. 10 => $10 => 1000 cents
  if (value <= 1000 && value % 100 === 0) return value * 100 // e.g. 100 => $100 => 10000 cents
  return Math.round(value) // already cents (e.g. 994, 10000)
}

function getOrderValueCents(context: Record<string, unknown>): number {
  const ctx = context as {
    item_subtotal?: number
    subtotal?: number
    items?: Array<{ unit_price?: number; quantity?: number }>
  }
  if (typeof ctx?.item_subtotal === "number" && ctx.item_subtotal >= 0) {
    return toCents(ctx.item_subtotal)
  }
  if (typeof ctx?.subtotal === "number" && ctx.subtotal >= 0) {
    return toCents(ctx.subtotal)
  }
  if (Array.isArray(ctx?.items) && ctx.items.length > 0) {
    const sum = ctx.items.reduce((acc, item) => {
      const price = typeof item?.unit_price === "number" ? item.unit_price : 0
      const qty = typeof item?.quantity === "number" ? item.quantity : 0
      return acc + price * qty
    }, 0)
    return toCents(sum)
  }
  return 0
}

function calculateDeliveryFeeCents(orderValueCents: number): number {
  const pct =
    orderValueCents >= ORDER_VALUE_THRESHOLD_CENTS
      ? FEE_PCT_ABOVE_THRESHOLD
      : FEE_PCT_BELOW_THRESHOLD
  return Math.round((orderValueCents * pct) / 100)
}

export class DynamicDeliveryFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "dynamic_delivery"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: "delivery_slot", name: "Delivery" },
      { id: "pickup_slot", name: "Pickup" },
    ]
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data ?? {}
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<CalculatedShippingOptionPrice> {
    const orderValueCents = getOrderValueCents(context)
    const feeCents = calculateDeliveryFeeCents(orderValueCents)
    return {
      calculated_amount: feeCents,
      is_calculated_price_tax_inclusive: false,
    }
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<unknown> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [DynamicDeliveryFulfillmentService],
})
