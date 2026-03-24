/**
 * Pick Order — pick line items and adjust weight for a specific order (from route :id).
 * Pick column: Pick All and per-row checkboxes. Unpicked items are zeroed; order total, tax, and promotion recalculated.
 * Amounts from API are in minor units (cents); we display as dollars.
 */

import { Button, Table, useToast } from "@medusajs/ui"
import { ArrowPath, ArrowLeft, ArrowRight } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useMemo, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"

/** Format amount to dollar display. API amounts are in cents (e.g. 1050 → "10.50", 50 → "0.50"). Handles number, string, or undefined. */
function toDollars(amount: number | string | undefined | null): string {
  if (amount == null) return "—"
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return "—"
  return (n / 100).toFixed(2)
}

/** Line total: use item.total if present and non-zero, else quantity × unit_price (all in minor units). */
function getLineTotal(item: { quantity?: number; unit_price?: number; total?: number }): number | undefined {
  const total = item.total
  if (total != null && typeof total === "number" && total > 0) return total
  const q = item.quantity ?? 0
  const up = item.unit_price
  if (typeof up === "number" && (typeof q === "number" && Number.isFinite(q))) return Math.round(up * q)
  return undefined
}

/** True when variant title indicates a count (non-weighted) item, e.g. "count", "1 each", "each". */
function isCountVariant(title: string | undefined): boolean {
  const t = (title ?? "").toLowerCase().trim()
  return t === "count" || t === "1 each" || t === "each"
}

/** Line total for display: when user has entered actual weight for a sold-by-weight item, use that to recalculate; otherwise use getLineTotal. */
function getDisplayLineTotal(
  item: { quantity?: number; unit_price?: number; total?: number; sold_by_weight?: boolean },
  actualWeightInput: string | undefined
): number | undefined {
  if (item.sold_by_weight && actualWeightInput?.trim()) {
    const w = parseFloat(actualWeightInput.trim())
    const up = item.unit_price
    if (Number.isFinite(w) && w > 0 && typeof up === "number") return Math.round(w * up)
  }
  return getLineTotal(item)
}

export default function OrderWeightPage() {
  const { id: orderIdFromRoute } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [actualWeights, setActualWeights] = useState<Record<string, string>>({})
  /** Line item id -> picked (default true when order loads). */
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  /** Substitute modal: which line item we're substituting for. */
  const [substituteFor, setSubstituteFor] = useState<{ lineItemId: string; productTitle: string } | null>(null)
  const [substituteSearch, setSubstituteSearch] = useState("")
  const [substituteSearchResults, setSubstituteSearchResults] = useState<
    { id: string; title: string; variants: { id: string; title?: string; sku?: string; prices?: { amount: number }[] }[] }[]
  >([])
  const [substituteSearching, setSubstituteSearching] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const {
    data: orderData,
    isLoading: loadingOrder,
    error: orderError,
  } = useQuery({
    queryKey: ["admin", "order", orderIdFromRoute],
    queryFn: () => api.orders.get(orderIdFromRoute!),
    enabled: !!orderIdFromRoute,
  })

  const order = orderData?.order ?? null

  useEffect(() => {
    const items = order?.items ?? []
    if (items.length) {
      setPicked((prev) => {
        const next = { ...prev }
        for (const item of items) {
          if (next[item.id] === undefined) next[item.id] = item.picked !== false
        }
        return next
      })
    }
  }, [order?.id, order?.items])

  const itemIds = useMemo(() => (order?.items ?? []).map((i) => i.id), [order?.items])
  const allPicked = itemIds.length > 0 && itemIds.every((id) => picked[id] !== false)
  const setAllPicked = useCallback(
    (value: boolean) => {
      setPicked((prev) => {
        const next = { ...prev }
        for (const id of itemIds) next[id] = value
        return next
      })
    },
    [itemIds]
  )

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (!order?.id) throw new Error("No order")
      const items = order.items ?? []
      const pickedIds = new Set(items.filter((i) => picked[i.id] !== false).map((i) => i.id))
      if (pickedIds.size === 0) throw new Error("Select at least one item to pick.")
      const lineItems = items.map((item) => {
        const isPicked = picked[item.id] !== false
        const payload: { line_item_id: string; picked: boolean; actual_weight?: number } = {
          line_item_id: item.id,
          picked: isPicked,
        }
        const isWeightItem = item.sold_by_weight === true && !isCountVariant(item.variant_title)
        if (isPicked && isWeightItem) {
          const v = actualWeights[item.id]?.trim()
          const n = v ? parseFloat(v) : NaN
          if (!Number.isFinite(n) || n <= 0) throw new Error(`Enter actual weight for picked item: ${item.product_title ?? item.id}`)
          payload.actual_weight = n
        }
        return payload
      })
      return api.orders.adjustWeight(order.id, lineItems)
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Pick and totals updated. Order status is now Ready for pickup.",
      })
      setActualWeights({})
      const orderId = order?.id
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "order", orderId] })
        await queryClient.refetchQueries({ queryKey: ["admin", "order", orderId] })
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
      navigate("/orders?tab=ready_for_pickup", { replace: true })
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "error" }),
  })

  const handleApply = useCallback(() => {
    adjustMutation.mutate()
  }, [adjustMutation])

  // Debounced product search for substitute modal
  useEffect(() => {
    if (!substituteFor || substituteSearch.trim().length < 2) {
      setSubstituteSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSubstituteSearching(true)
      try {
        const res = await api.searchProducts(substituteSearch.trim())
        setSubstituteSearchResults(res.products ?? [])
      } catch {
        setSubstituteSearchResults([])
      } finally {
        setSubstituteSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [substituteFor, substituteSearch])

  const substituteMutation = useMutation({
    mutationFn: ({ lineItemId, substituteVariantId }: { lineItemId: string; substituteVariantId: string }) => {
      if (!order?.id) throw new Error("No order")
      return api.orders.substituteLine(order.id, lineItemId, substituteVariantId)
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Line item substituted. Order updated." })
      setSubstituteFor(null)
      setSubstituteSearch("")
      setSubstituteSearchResults([])
      setSelectedVariantId(null)
      if (order?.id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "order", order.id] })
        queryClient.refetchQueries({ queryKey: ["admin", "order", order.id] })
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "error" }),
  })

  const markPickedUpMutation = useMutation({
    mutationFn: () => {
      if (!order?.id) throw new Error("No order")
      return api.orders.markPickedUp(order.id)
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Order marked as picked up. It will appear under Completed." })
      if (order?.id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "order", order.id] })
        queryClient.refetchQueries({ queryKey: ["admin", "order", order.id] })
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "error" }),
  })

  const handleConfirmSubstitute = useCallback(() => {
    if (!substituteFor || !selectedVariantId) return
    substituteMutation.mutate({ lineItemId: substituteFor.lineItemId, substituteVariantId: selectedVariantId })
  }, [substituteFor, selectedVariantId, substituteMutation])

  const pickedCount = (order?.items ?? []).filter((i) => picked[i.id] !== false).length
  const pickedWeightItems = (order?.items ?? []).filter(
    (i) => picked[i.id] !== false && i.sold_by_weight === true && !isCountVariant(i.variant_title)
  )
  const hasWeightsForPickedWeightItems = pickedWeightItems.length === 0 || pickedWeightItems.every(
    (item) => actualWeights[item.id]?.trim() && parseFloat(actualWeights[item.id]!.trim()) > 0
  )
  const canApply = pickedCount > 0 && hasWeightsForPickedWeightItems

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50">
      <div className="content-container py-8">
        <button
          type="button"
          onClick={() => navigate("/orders")}
          className="flex items-center gap-2 text-green-700 hover:text-green-800 font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-green-200/50 rounded-full shadow-sm mb-3">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">Pick order</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pick Order</h1>
          <p className="text-gray-600 mt-1">
            Pick items to include; uncheck items not picked (they will be excluded from total). Enter actual weight for sold-by-weight items. Totals, tax, and promotions recalculate when you apply.
          </p>
        </div>

        {!orderIdFromRoute && (
          <div className="card p-6 text-gray-500">No order selected. Go back and choose an order.</div>
        )}

        {orderIdFromRoute && loadingOrder && (
          <div className="card p-12 text-center text-gray-500">Loading order…</div>
        )}

        {orderIdFromRoute && orderError && (
          <div className="card p-6 border-red-200 bg-red-50">
            <p className="text-red-700">{orderError instanceof Error ? orderError.message : "Failed to load order."}</p>
          </div>
        )}

        {order && (() => {
          const itemsSub = order.subtotal ?? order.item_total ?? 0
          const ship = order.shipping_total ?? 0
          const tax = order.tax_total ?? 0
          const discount = order.discount_total ?? 0
          const orderTotal = order.total ?? (itemsSub + ship + tax - discount)
          const pickedItems = (order.items ?? []).filter((i) => picked[i.id] !== false)
          const previewSubtotal = pickedItems.reduce((sum, item) => {
            const lineTotal = getDisplayLineTotal(item, actualWeights[item.id]) ?? getLineTotal(item) ?? 0
            return sum + lineTotal
          }, 0)
          const ratio = itemsSub > 0 ? previewSubtotal / itemsSub : 1
          const previewTax = Math.round(tax * ratio)
          const previewDiscount = Math.round(discount * ratio)
          const previewTotal = previewSubtotal + ship + previewTax - previewDiscount
          const hasWeightOrPickChanges = Object.keys(actualWeights).length > 0 || pickedCount < (order.items?.length ?? 0)
          const displayTotal = orderTotal
          const displaySubtotal = itemsSub
          const displayTax = tax
          const displayDiscount = discount
          return (
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm text-gray-600">
                Order <span className="font-mono font-medium text-gray-900">{order.id}</span>
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Order total: ${toDollars(displayTotal)}
              </p>
              <p className="text-sm text-gray-700 mt-2 font-medium">
                Calculation: Items ${toDollars(displaySubtotal)}
                {displayDiscount > 0 ? ` − Promotions ${toDollars(displayDiscount)}` : ""}
                {ship > 0 ? ` + Shipping ${toDollars(ship)}` : ""}
                {displayTax > 0 ? ` + Tax ${toDollars(displayTax)}` : ""}
                {" = "}
                <span className="text-gray-900">${toDollars(displayTotal)}</span>
              </p>
              {hasWeightOrPickChanges && (
                <p className="text-sm text-green-700 mt-2">
                  To be (if you apply now): <strong>${toDollars(previewTotal)}</strong> — Items ${toDollars(previewSubtotal)} − Promotions ${toDollars(previewDiscount)} + Shipping ${toDollars(ship)} + Tax ${toDollars(previewTax)}. {pickedCount} of {order.items?.length ?? 0} items picked.
                </p>
              )}
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-gray-700">
                  Items total: ${toDollars(displaySubtotal)}
                </p>
                {displayDiscount > 0 && (
                  <p className="text-gray-700">Promotions (discount): -${toDollars(displayDiscount)}</p>
                )}
                {ship > 0 && (
                  <p className="text-gray-700">Shipping: ${toDollars(ship)}</p>
                )}
                {displayTax > 0 && (
                  <p className="text-gray-700">Tax: ${toDollars(displayTax)}</p>
                )}
                <p className="text-gray-600 pt-1">
                  Enter actual weight to recalculate line totals. Click &quot;Apply pick &amp; recalculate&quot; to save weights, recalculate order total, and apply promotion and shipping.
                </p>
                {(order.store?.delivery_store_name || order.store?.delivery_store_address) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Store / delivery</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{order.store?.delivery_store_name ?? "—"}</p>
                    {order.store?.delivery_store_address && (
                      <p className="text-sm text-gray-600 mt-0.5">{order.store.delivery_store_address}</p>
                    )}
                    {(order.store?.delivery_slot_date_label || order.store?.delivery_slot_start) && (
                      <p className="text-sm text-gray-600 mt-1">
                        Slot: {[order.store.delivery_slot_date_label, order.store.delivery_slot_start, order.store.delivery_slot_end].filter(Boolean).join(" ")}
                      </p>
                    )}
                    {order.store?.order_instructions && (
                      <p className="text-sm text-gray-600 mt-1 italic">Instructions: {order.store.order_instructions}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto flex justify-center">
              <Table className="mx-auto">
                <Table.Header>
                  <Table.Row className="bg-gray-50">
                    <Table.HeaderCell className="font-semibold text-center">Product</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center">Est. weight (qty)</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center">Type</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center">Unit price</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center">Line total</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center">Actual Weight/Count</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center">
                      <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allPicked}
                          onChange={(e) => setAllPicked(e.target.checked)}
                          aria-label="Pick all"
                          className="h-5 w-5 rounded border-2 border-gray-400 text-green-600 accent-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-700">Pick</span>
                      </label>
                    </Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center text-gray-700">Allow Substitution</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center text-gray-700">Product Note</Table.HeaderCell>
                    <Table.HeaderCell className="font-semibold text-center text-gray-700">Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(order.items ?? []).map((item) => {
                    const displayLineTotal = getDisplayLineTotal(item, actualWeights[item.id])
                    const lineTotal = displayLineTotal ?? getLineTotal(item) ?? item.total
                    const displayQty = item.quantity != null && Number.isFinite(item.quantity) ? item.quantity : "—"
                    const showWeightInput = item.sold_by_weight === true
                    const isCountType = isCountVariant(item.variant_title) || !showWeightInput
                    const isPicked = picked[item.id] !== false
                    return (
                      <Table.Row key={item.id} className={`${isPicked ? "hover:bg-green-50/50" : "bg-gray-100/80"} ${isCountType ? "opacity-90" : ""}`}>
                        <Table.Cell className="font-medium text-center">{item.product_title ?? item.id}</Table.Cell>
                        <Table.Cell className="text-center">{displayQty}</Table.Cell>
                        <Table.Cell className="text-gray-700 text-center">{item.variant_title ?? "—"}</Table.Cell>
                        <Table.Cell className="text-center">${toDollars(item.unit_price)}</Table.Cell>
                        <Table.Cell className={`text-center ${isPicked ? "" : "text-gray-400"}`}>
                          ${toDollars(isPicked ? (displayLineTotal ?? lineTotal ?? item.total) : 0)}
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          {isCountType ? (
                            <span className="text-gray-400 text-sm">—</span>
                          ) : showWeightInput ? (
                            isPicked ? (
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                placeholder="Enter weight"
                                value={actualWeights[item.id] ?? ""}
                                onChange={(e) =>
                                  setActualWeights((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className="w-36 min-w-[8rem] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none mx-auto block"
                                aria-label={`Actual weight for ${item.variant_title ?? item.product_title ?? item.id}`}
                              />
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )
                          ) : (
                            <span className="text-gray-400 text-sm italic">Enter count</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer select-none w-full">
                            <input
                              type="checkbox"
                              checked={isPicked}
                              onChange={(e) => setPicked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                              aria-label={`Pick ${item.product_title ?? item.id}`}
                              className="h-5 w-5 rounded border-2 border-gray-400 text-green-600 accent-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                            />
                          </label>
                        </Table.Cell>
                        <Table.Cell className="text-center text-sm">
                          {item.allow_substitution !== false ? "Yes" : "No"}
                        </Table.Cell>
                        <Table.Cell className="text-center text-sm max-w-[12rem] truncate" title={item.substitution_note ?? ""}>
                          {item.substitution_note ?? "—"}
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          {item.allow_substitution !== false ? (
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => setSubstituteFor({ lineItemId: item.id, productTitle: item.product_title ?? item.id })}
                              className="gap-1"
                            >
                              <ArrowRight className="w-4 h-4" />
                              Substitute
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table>
            </div>
            <div className="p-6 border-t border-gray-100 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleApply}
                disabled={adjustMutation.isPending || !canApply}
                className="btn-primary"
              >
                <ArrowPath className="w-4 h-4 mr-2" />
                Apply pick & recalculate
              </Button>
              {(() => {
                const meta = (order.metadata ?? {}) as Record<string, unknown>
                const hasStoreAppliedPick = typeof meta.picked_total === "number" && Number.isFinite(meta.picked_total)
                const alreadyPickedUp = meta.customer_picked_up_at != null && String(meta.customer_picked_up_at).trim() !== ""
                const showMarkPickedUp = hasStoreAppliedPick && !alreadyPickedUp
                return showMarkPickedUp ? (
                  <Button
                    variant="secondary"
                    onClick={() => markPickedUpMutation.mutate()}
                    disabled={markPickedUpMutation.isPending}
                  >
                    {markPickedUpMutation.isPending ? "Marking…" : "Mark as picked up"}
                  </Button>
                ) : null
              })()}
              <span className="text-sm text-gray-500">
                {canApply
                  ? "Saves weights and recalculates order total, promotion (discount), and shipping for picked items."
                  : pickedCount === 0
                    ? "Pick at least one item."
                    : "Enter actual weight for all picked sold-by-weight items."}
              </span>
            </div>
          </div>
          );
        })()}

        {/* Substitute item modal */}
        {substituteFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSubstituteFor(null)}>
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Substitute item</h2>
                <p className="text-sm text-gray-600 mt-1">Replacing: <strong>{substituteFor.productTitle}</strong></p>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search product (min 2 characters)</label>
                <input
                  type="text"
                  value={substituteSearch}
                  onChange={(e) => setSubstituteSearch(e.target.value)}
                  placeholder="Product name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  autoFocus
                />
                {substituteSearching && <p className="text-sm text-gray-500 mt-2">Searching…</p>}
                {!substituteSearching && substituteSearch.trim().length >= 2 && substituteSearchResults.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No products found. Try a different search.</p>
                )}
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {substituteSearchResults.map((product) =>
                    (product.variants ?? []).map((v) => {
                      const amount = v.prices?.[0]?.amount
                      const priceStr = amount != null ? `$${(amount / 100).toFixed(2)}` : ""
                      const label = `${product.title}${v.title ? ` – ${v.title}` : ""} ${priceStr}`.trim()
                      const isSelected = selectedVariantId === v.id
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${isSelected ? "border-green-600 bg-green-50 ring-2 ring-green-500" : "border-gray-200 hover:bg-gray-50"}`}
                        >
                          {label}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setSubstituteFor(null)}>Cancel</Button>
                <Button
                  disabled={!selectedVariantId || substituteMutation.isPending}
                  onClick={handleConfirmSubstitute}
                >
                  {substituteMutation.isPending ? "Substituting…" : "Confirm substitute"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
