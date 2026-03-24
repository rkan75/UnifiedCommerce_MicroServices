/**
 * Store subscription DTOs — align with your Medusa custom module API responses.
 * @see docs/SUBSCRIPTIONS.md
 */

export type SubscriptionStatus =
  | "draft"
  | "active"
  | "paused"
  | "past_due"
  | "cancelled"

export type SubscriptionIntervalUnit = "day" | "week" | "month" | "year"

export type StoreSubscriptionItem = {
  id: string
  variant_id: string
  product_id?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
}

export type StoreSubscriptionPaymentSummary = {
  provider_id?: string | null
  /** e.g. Visa •••• 4242 */
  label?: string | null
  expires_month?: number | null
  expires_year?: number | null
}

export type StoreSubscriptionShippingSummary = {
  address_id?: string | null
  label?: string | null
  city?: string | null
  country_code?: string | null
  postal_code?: string | null
}

export type StoreSubscription = {
  id: string
  status: SubscriptionStatus
  interval_unit: SubscriptionIntervalUnit
  interval_count: number
  currency_code: string
  /** Null when paused (no scheduled refill until resumed). */
  next_run_at: string | null
  last_run_at?: string | null
  items: StoreSubscriptionItem[]
  payment?: StoreSubscriptionPaymentSummary | null
  shipping?: StoreSubscriptionShippingSummary | null
  metadata?: Record<string, unknown> | null
}

export type ListSubscriptionsResponse = {
  subscriptions: StoreSubscription[]
}
