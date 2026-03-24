/**
 * API client for unifiedcommerce-grocery-store backend (Medusa admin APIs).
 * Uses VITE_MEDUSA_BACKEND_URL when set; otherwise relative URLs (rely on Vite proxy in dev).
 * Sends Authorization: Bearer <token> when getToken() returns a value (store associate login).
 */

import { getToken } from "./auth"

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_MEDUSA_BACKEND_URL
  if (url && typeof url === "string") return url.replace(/\/$/, "")
  return ""
}

function getHeaders(includeAuth = true): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (includeAuth) {
    const token = getToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

export type OrderItem = {
  id: string
  quantity?: number
  unit_price?: number
  total?: number
  product_title?: string
  variant_id?: string
  /** Variant option title (e.g. "3 lb", "1 each") so store users see which variant they are updating. */
  variant_title?: string
  /** If true, show actual weight input; if false, hide or disable. From variant metadata sold_by_weight or sort_by_weight. */
  sold_by_weight?: boolean
  /** False when line was marked not picked (excluded from order total). */
  picked?: boolean
  /** Customer preference: allow substitution when item is unavailable (default true). */
  allow_substitution?: boolean
  /** Customer note for substitution (e.g. "similar brand OK"). */
  substitution_note?: string
}

/** Store/delivery info from order metadata (set when user selects store for delivery or pickup). */
export type OrderStoreInfo = {
  delivery_store_id?: string
  delivery_store_name?: string
  delivery_store_address?: string
  delivery_slot_date_label?: string
  delivery_slot_start?: string
  delivery_slot_end?: string
  order_instructions?: string
}

export type Order = {
  id: string
  total?: number
  subtotal?: number
  item_total?: number
  shipping_total?: number
  tax_total?: number
  /** Promotions/discounts total (subtracted from order total). */
  discount_total?: number
  items?: OrderItem[]
  created_at?: string
  display_id?: number
  status?: string
  email?: string
  /** Store/location for delivery or pickup (from order metadata). */
  store?: OrderStoreInfo
  metadata?: Record<string, unknown>
}

export type OrderListResponse = {
  orders: Order[]
  count?: number
  offset?: number
  limit?: number
}

async function fetchApi<T>(path: string, options?: RequestInit & { skipAuth?: boolean }): Promise<T> {
  const base = getBaseUrl()
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`
  const { skipAuth, ...rest } = options ?? {}
  const res = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: { ...getHeaders(!skipAuth), ...rest?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message?: string }).message || "Request failed")
  }
  return res.json()
}

export type BackofficeUser = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  store_id?: string
  is_admin: boolean
  /** True for admins or users with Store Admin User role; can access Create store user. */
  can_create_store_user?: boolean
}

export type StoreLocation = {
  id: string
  name: string
  address_1?: string
  city?: string
  state?: string
  zip?: string
  country_code?: string
}

export type RbacRole = {
  id: string
  name: string
  description?: string
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchApi<{ token: string }>("/auth/user/emailpass", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      }),
  },
  me: () => fetchApi<{ user: BackofficeUser }>("/admin/me"),
  storeLocations: () =>
    fetchApi<{ store_locations: StoreLocation[] }>("/admin/store-locations"),
  roles: {
    list: () => fetchApi<{ roles: RbacRole[] }>("/admin/roles"),
  },
  storeUsers: {
    create: (body: { email: string; password: string; first_name?: string; last_name?: string; store_id: string; role_id?: string }) =>
      fetchApi<{ success: boolean; user: { id: string; email: string; first_name?: string; last_name?: string; store_id: string; role_id?: string } }>("/admin/store-users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  users: {
    list: () => fetchApi<{ users: { id: string; email: string; first_name?: string; last_name?: string; rbac_roles?: { id: string; name: string }[] }[] }>("/admin/users"),
    get: (id: string) => fetchApi<{ user: { id: string; email: string; first_name?: string; last_name?: string; rbac_roles?: { id: string; name: string }[] } }>(`/admin/users/${encodeURIComponent(id)}`),
    setRoles: (userId: string, roleIds: string[]) =>
      fetchApi<{ user_id: string; role_ids: string[] }>(`/admin/users/${encodeURIComponent(userId)}/roles`, {
        method: "POST",
        body: JSON.stringify({ role_ids: roleIds }),
      }),
  },
  orders: {
    list: (params?: { limit?: number; offset?: number; status?: string; store_id?: string }) => {
      const sp = new URLSearchParams()
      if (params?.limit != null) sp.set("limit", String(params.limit))
      if (params?.offset != null) sp.set("offset", String(params.offset))
      if (params?.status) sp.set("status", params.status)
      const q = sp.toString()
      const headers: Record<string, string> = {}
      if (params?.store_id) headers["X-Store-Id"] = params.store_id
      return fetchApi<OrderListResponse>(`/admin/orders${q ? `?${q}` : ""}`, { headers })
    },
    get: (id: string) =>
      fetchApi<{ order: Order }>(
        `/admin/orders/${encodeURIComponent(id)}/weight-detail`
      ),
    adjustWeight: (
      id: string,
      lineItems: { line_item_id: string; picked: boolean; actual_weight?: number; unit_price?: number }[]
    ) =>
      fetchApi<{ order: Order; success: boolean }>(`/admin/orders/${encodeURIComponent(id)}/adjust-weight`, {
        method: "POST",
        body: JSON.stringify({ lineItems }),
      }),
    substituteLine: (orderId: string, lineItemId: string, substituteVariantId: string) =>
      fetchApi<{ success: boolean; message?: string }>(
        `/admin/orders/${encodeURIComponent(orderId)}/substitute-line`,
        {
          method: "POST",
          body: JSON.stringify({ line_item_id: lineItemId, substitute_variant_id: substituteVariantId }),
        }
      ),
    /** Mark order as picked up by customer (moves to Completed tab). */
    markPickedUp: (orderId: string) =>
      fetchApi<{ success: boolean; message?: string }>(
        `/admin/orders/${encodeURIComponent(orderId)}/mark-picked-up`,
        { method: "POST" }
      ),
  },
  /** Search products/variants for substitution (uses admin price-update search). */
  searchProducts: (q: string) =>
    fetchApi<{ products: { id: string; title: string; variants: { id: string; title?: string; sku?: string; prices?: { amount: number; currency_code?: string }[] }[] }[] }>(
      `/admin/price-update/search?q=${encodeURIComponent(q.trim())}`
    ),
}
