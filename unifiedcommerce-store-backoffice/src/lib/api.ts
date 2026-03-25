/**
 * API client for the store backend (Medusa admin for orders/users/etc.).
 * Product substitution search uses Java products-service only (VITE_PRODUCTS_SERVICE_URL).
 * Uses VITE_MEDUSA_BACKEND_URL when set; otherwise relative URLs (Vite proxy in dev).
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

/** Map Java GET /store/products row to substitution-search shape (prices in minor units). */
function mapJavaStoreProductToSearchRow(p: {
  id?: string
  title?: string
  variants?: Array<{
    id?: string
    title?: string
    sku?: string
    calculated_price?: { calculated_amount?: number; currency_code?: string }
  }>
}): {
  id: string
  title: string
  variants: {
    id: string
    title?: string
    sku?: string
    prices?: { amount: number; currency_code?: string }[]
  }[]
} {
  return {
    id: p.id ?? "",
    title: p.title ?? "",
    variants: (p.variants ?? []).map((v) => ({
      id: v.id ?? "",
      title: v.title,
      sku: v.sku,
      prices:
        v.calculated_price?.calculated_amount != null
          ? [
              {
                amount: Number(v.calculated_price.calculated_amount),
                currency_code: v.calculated_price.currency_code,
              },
            ]
          : [],
    })),
  }
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
  /**
   * Search products for substitution (Java products-service GET /store/products only).
   * Optional VITE_PRODUCTS_SEARCH_REGION_ID for variant prices.
   */
  searchProducts: async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return { products: [] }

    const productsBase = import.meta.env.VITE_PRODUCTS_SERVICE_URL?.replace(/\/$/, "")
    if (!productsBase) {
      throw new Error(
        "Set VITE_PRODUCTS_SERVICE_URL to your Java products-service base URL (e.g. http://localhost:8082)."
      )
    }

    const sp = new URLSearchParams()
    const region = import.meta.env.VITE_PRODUCTS_SEARCH_REGION_ID?.trim()
    if (region) sp.set("region_id", region)
    if (/^prod_[a-z0-9]+$/i.test(trimmed)) {
      sp.append("id", trimmed)
      sp.set("limit", "5")
    } else {
      sp.set("q", trimmed)
      sp.set("limit", "20")
    }
    const url = `${productsBase}/store/products?${sp.toString()}`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(err.slice(0, 160) || "Product search failed")
    }
    const data = (await res.json()) as { products?: unknown[] }
    const products = (data.products ?? []).map((p) =>
      mapJavaStoreProductToSearchRow(p as Parameters<typeof mapJavaStoreProductToSearchRow>[0])
    )
    return { products }
  },
}
