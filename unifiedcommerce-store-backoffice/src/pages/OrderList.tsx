/**
 * Order maintenance — list orders for the store (fancy storefront theme).
 * Shows user details at top; admin can select store from dropdown; store users see only their store's orders.
 * Three tabs: Pickup orders (assigned to store, not yet worked on), Ready for pickup (store picked & adjusted weight),
 * Completed (customer picked up from store).
 * - Pickup orders: click order → navigate to weight/pick page to edit.
 * - Ready for pickup: read-only; only "Mark as Pick up" button is enabled; on click → mark complete and redirect to Completed tab.
 * - Completed: read-only list.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import { MagnifyingGlass } from "@medusajs/icons"
import { Button, useToast } from "@medusajs/ui"
import { api, type Order, type OrderListResponse, type BackofficeUser, type StoreLocation } from "@/lib/api"
import { useState, useEffect } from "react"

export type OrderWorkflowTab = "pickup" | "ready_for_pickup" | "completed"

/** Determines which bucket an order belongs to for the store workflow. */
export function getOrderWorkflowBucket(order: Order): OrderWorkflowTab {
  const status = (order.status ?? "").toLowerCase()
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const workflowStatus = meta.store_workflow_status as string | undefined
  const pickedTotal = meta.picked_total
  const customerPickedUp = meta.customer_picked_up_at != null && String(meta.customer_picked_up_at).trim() !== ""
  const hasStoreAppliedPick =
    typeof pickedTotal === "number" && Number.isFinite(pickedTotal)
  const isCompleted =
    workflowStatus === "completed" ||
    customerPickedUp ||
    status === "completed" ||
    status === "fulfilled" ||
    status === "delivered"
  if (isCompleted) return "completed"
  if (workflowStatus === "ready_for_pickup" || hasStoreAppliedPick) return "ready_for_pickup"
  return "pickup"
}

const TAB_LABELS: Record<OrderWorkflowTab, string> = {
  pickup: "Pickup orders",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
}

/** Display status for order list badge: use workflow status from metadata when present, else core order.status. */
export function getOrderDisplayStatus(order: Order): string {
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const workflow = meta.store_workflow_status as string | undefined
  if (workflow === "completed") return "Completed"
  if (workflow === "ready_for_pickup") return "Ready for pickup"
  const status = (order.status ?? "").trim()
  if (status) return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  return "Pending"
}

function formatDate(iso?: string): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function formatMoney(amount: number | undefined): string {
  if (amount == null || typeof amount !== "number") return "—"
  return (amount / 100).toFixed(2)
}

const TAB_PARAM = "tab"
const VALID_TABS: OrderWorkflowTab[] = ["pickup", "ready_for_pickup", "completed"]

export default function OrderListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [orderNumberSearch, setOrderNumberSearch] = useState<string>("")
  const [activeTab, setActiveTab] = useState<OrderWorkflowTab>("pickup")

  const markPickedUpMutation = useMutation({
    mutationFn: (orderId: string) => api.orders.markPickedUp(orderId),
    onSuccess: () => {
      toast({ title: "Success", description: "Order marked as picked up. Status updated to Completed." })
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
      setSearchParams({ [TAB_PARAM]: "completed" })
      setActiveTab("completed")
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "error" }),
  })

  useEffect(() => {
    const tabParam = searchParams.get(TAB_PARAM)
    if (tabParam && VALID_TABS.includes(tabParam as OrderWorkflowTab)) {
      setActiveTab(tabParam as OrderWorkflowTab)
    }
  }, [searchParams])

  const { data: meData } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => api.me(),
  })
  const user = meData?.user as BackofficeUser | undefined

  const { data: storesData } = useQuery({
    queryKey: ["admin", "store-locations"],
    queryFn: () => api.storeLocations(),
    enabled: !!user?.is_admin,
  })
  const storeLocations: StoreLocation[] = storesData?.store_locations ?? []

  const effectiveStoreId = user?.is_admin ? (selectedStoreId || undefined) : user?.store_id
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "orders", "list", effectiveStoreId],
    queryFn: () => api.orders.list({ limit: 100, store_id: effectiveStoreId }),
  })

  // Medusa may return { orders }, { data: { orders } }, or array
  const raw = data as OrderListResponse & { data?: { orders?: Order[] } } | Order[] | undefined
  const orders: Order[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.orders)
      ? raw.orders
      : Array.isArray(raw?.data?.orders)
        ? raw.data.orders
        : []

  const currentStoreName = user?.is_admin
    ? selectedStoreId
      ? storeLocations.find((s) => s.id === selectedStoreId)?.name ?? "Selected store"
      : "All stores"
    : storeLocations.find((s) => s.id === user?.store_id)?.name ?? user?.store_id ?? "Store"

  const searchTrim = orderNumberSearch.trim().toLowerCase()
  const bySearch =
    !searchTrim
      ? orders
      : orders.filter((o) => {
          const displayId = String(o.display_id ?? "").toLowerCase()
          const id = (o.id ?? "").toLowerCase()
          return displayId.includes(searchTrim) || id.includes(searchTrim)
        })
  const filteredOrders = bySearch.filter((o) => getOrderWorkflowBucket(o) === activeTab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50">
      <div className="content-container py-8">
        {/* User details at top */}
        {user && (
          <div className="mb-6 p-4 bg-white/90 border border-green-200/60 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Signed in as</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">
              {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}
            </p>
            <p className="text-sm text-gray-600">{user.email}</p>
            <p className="text-sm text-green-700 mt-1">
              {user.is_admin
                ? "Admin — you can view all stores or filter by store"
                : `Store user — only orders for: ${currentStoreName}`}
            </p>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-green-200/50 rounded-full shadow-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">Order maintenance</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <MagnifyingGlass className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={orderNumberSearch}
                onChange={(e) => setOrderNumberSearch(e.target.value)}
                placeholder="Search by order number"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-52 min-w-0 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                aria-label="Search by order number"
              />
              {orderNumberSearch && (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setOrderNumberSearch("")}
                  aria-label="Clear search"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Select an order to pick items and adjust weights.</p>

          {user?.is_admin && storeLocations.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <label htmlFor="store-select" className="text-sm font-medium text-gray-700">
                Filter by store:
              </label>
              <select
                id="store-select"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All stores</option>
                {storeLocations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">
                {selectedStoreId ? "Showing orders for selected store" : "Showing orders from all stores"}
              </span>
            </div>
          )}
          {user && !user.is_admin && (
            <p className="mt-4 text-sm text-gray-600">
              Showing only orders for your store. Contact an admin to change store access.
            </p>
          )}

          {/* Tabs: Pickup orders | Ready for pickup | Completed */}
          {!isLoading && !error && orders.length > 0 && (
            <div className="mt-6 flex border-b border-gray-200 gap-1" role="tablist" aria-label="Order workflow">
              {(["pickup", "ready_for_pickup", "completed"] as OrderWorkflowTab[]).map((tab) => {
                const count = orders.filter((o) => getOrderWorkflowBucket(o) === tab).length
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls={`orders-panel-${tab}`}
                    id={`tab-${tab}`}
                    onClick={() => {
                      setActiveTab(tab)
                      setSearchParams(tab === "pickup" ? {} : { [TAB_PARAM]: tab })
                    }}
                    className={[
                      "px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
                      activeTab === tab
                        ? "border-green-600 text-green-700 bg-green-50/80"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {TAB_LABELS[tab]}
                    <span className="ml-2 text-xs opacity-80">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="card p-12 text-center text-gray-500">Loading orders…</div>
        )}

        {error && (
          <div className="card p-6 border-red-200 bg-red-50">
            <p className="text-red-700">{error instanceof Error ? error.message : "Failed to load orders."}</p>
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="card p-12 text-center text-gray-500">
            {user?.is_admin ? "No orders found." : "No orders for your store."}
          </div>
        )}

        {!isLoading && !error && orders.length > 0 && filteredOrders.length === 0 && orderNumberSearch.trim() && (
          <div className="card p-8 text-center text-gray-600" id={`orders-panel-${activeTab}`} role="tabpanel">
            <p className="font-medium">No orders match &quot;{orderNumberSearch.trim()}&quot;</p>
            <p className="text-sm mt-1">Try a different order number or clear the search.</p>
            <Button
              type="button"
              variant="secondary"
              size="small"
              className="mt-3"
              onClick={() => setOrderNumberSearch("")}
            >
              Clear search
            </Button>
          </div>
        )}

        {!isLoading && !error && orders.length > 0 && filteredOrders.length === 0 && !orderNumberSearch.trim() && (
          <div className="card p-8 text-center text-gray-600" id={`orders-panel-${activeTab}`} role="tabpanel">
            <p className="font-medium">No {TAB_LABELS[activeTab].toLowerCase()} right now.</p>
            <p className="text-sm mt-1">
              {activeTab === "pickup" && "Orders assigned to this store will appear here until someone applies pick & recalculate."}
              {activeTab === "ready_for_pickup" && "After you apply pick & recalculate on the weight page, orders move here until the customer picks up."}
              {activeTab === "completed" && "Completed orders (customer picked up) will appear here."}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredOrders.length > 0 && (
          <div className="space-y-3" id={`orders-panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {(orderNumberSearch.trim() || orders.length !== filteredOrders.length) && (
              <p className="text-sm text-gray-500">
                Showing {filteredOrders.length} {TAB_LABELS[activeTab].toLowerCase()}
                {orderNumberSearch.trim() ? ` (of ${bySearch.length} matching search)` : ` (${orders.length} total)`}
              </p>
            )}
            {filteredOrders.map((order) => {
              const isPickupTab = activeTab === "pickup"
              const isReadyForPickupTab = activeTab === "ready_for_pickup"
              const cardContent = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-gray-900">
                        #{order.display_id ?? order.id.slice(-8)}
                      </span>
                      <span className="text-sm text-gray-500">{order.id}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {getOrderDisplayStatus(order)}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-500">{formatDate(order.created_at)}</span>
                      <span className="font-semibold text-green-700">${formatMoney(order.total)}</span>
                      {isPickupTab && <span className="text-gray-400 group-hover:translate-x-1 transition-transform">→</span>}
                      {isReadyForPickupTab && (
                        <Button
                          type="button"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            markPickedUpMutation.mutate(order.id)
                          }}
                          disabled={markPickedUpMutation.isPending}
                        >
                          {markPickedUpMutation.isPending && markPickedUpMutation.variables === order.id ? "Marking…" : "Mark as Pick up"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {Boolean(order.email || order.store?.delivery_store_name || (order.metadata as Record<string, unknown>)?.delivery_store_name) && (
                    <p className="text-sm text-gray-500 mt-2">
                      {String(order.email ?? "")}
                      {Boolean(order.store?.delivery_store_name ?? (order.metadata as Record<string, unknown>)?.delivery_store_name) && (
                        <span className="ml-2 text-gray-600">
                          · {String(order.store?.delivery_store_name ?? (order.metadata as Record<string, unknown>)?.delivery_store_name ?? "")}
                        </span>
                      )}
                    </p>
                  )}
                </>
              )
              if (isPickupTab) {
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => navigate(`/orders/${order.id}/weight`)}
                    className="card w-full text-left p-5 hover:shadow-xl hover:border-green-200 transition-all duration-200 group"
                  >
                    {cardContent}
                  </button>
                )
              }
              return (
                <div
                  key={order.id}
                  className="card w-full text-left p-5 border-gray-200"
                >
                  {cardContent}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
