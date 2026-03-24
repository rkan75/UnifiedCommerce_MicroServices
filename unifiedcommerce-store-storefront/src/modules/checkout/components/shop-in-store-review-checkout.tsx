"use client"

import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { addToWishlistByVariant } from "@lib/data/wishlist"
import { convertToLocale } from "@lib/util/money"
import {
  groupCartItemsByKey,
  locationGroupLabelForLineItem,
} from "@lib/util/shopping-list-grouping"
import { HttpTypes } from "@medusajs/types"
import { Button, Heading, Text, clx, toast } from "@medusajs/ui"
import { Minus, Plus, Spinner, Trash } from "@medusajs/icons"
import CheckoutMethodModal from "@modules/cart/components/checkout-method-modal"
import {
  dispatchCartUpdated,
  useCart,
} from "@modules/common/components/cart-provider"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

type Props = {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}

function getLineNote(meta: unknown): string {
  const m = meta as Record<string, unknown> | undefined
  const v = m?.list_note
  return typeof v === "string" ? v : ""
}

function ListForLaterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  )
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  )
}

const toolbarBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-header-red bg-white px-4 py-2.5 text-sm font-semibold text-header-red transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40"

export default function ShopInStoreReviewCheckout({ cart, customer }: Props) {
  const router = useRouter()
  const { refetchCart } = useCart() ?? {}
  const [view, setView] = useState<"department" | "location">("department")
  const [modalOpen, setModalOpen] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)
  const [emptying, setEmptying] = useState(false)
  const [savingLater, setSavingLater] = useState(false)

  const items = cart?.items ?? []
  const currencyCode = cart?.currency_code ?? "usd"
  const groups = useMemo(
    () => groupCartItemsByKey(items, view),
    [items, view]
  )

  const itemCount = useMemo(
    () => items.reduce((n, i) => n + (i.quantity ?? 0), 0),
    [items]
  )

  const persistNote = async (lineId: string, note: string) => {
    const item = items.find((i) => i.id === lineId)
    if (!item) return
    setSavingNoteId(lineId)
    try {
      const prev = (item.metadata ?? {}) as Record<string, unknown>
      const next = { ...prev, list_note: note }
      await updateLineItem({
        lineId,
        quantity: item.quantity,
        metadata: next,
      })
      await refetchCart?.()
      dispatchCartUpdated()
      router.refresh()
    } finally {
      setSavingNoteId(null)
    }
  }

  const handleEmptyList = async () => {
    if (!items.length) return
    setEmptying(true)
    try {
      await Promise.all(items.map((i) => deleteLineItem(i.id)))
      await refetchCart?.()
      dispatchCartUpdated()
      router.refresh()
      toast.success("List emptied")
    } catch {
      toast.error("Could not empty list. Try again.")
    } finally {
      setEmptying(false)
    }
  }

  const handleSaveForLater = async () => {
    if (!items.length) return
    if (!customer) {
      toast.error("Sign in to save items for later.")
      return
    }
    setSavingLater(true)
    try {
      let ok = 0
      for (const item of items) {
        const variantId = item.variant_id
        if (!variantId) continue
        const product = item.variant?.product as { id?: string } | undefined
        const productId = product?.id ?? null
        const qty = item.quantity ?? 1
        const r = await addToWishlistByVariant(variantId, productId, qty)
        if (r.success) ok++
      }
      if (ok > 0) {
        toast.success(
          ok === items.length
            ? "All items saved to your wishlist"
            : `${ok} item(s) saved to your wishlist`
        )
        router.refresh()
      } else {
        toast.error("Could not save items. Try again.")
      }
    } catch {
      toast.error("Could not save for later.")
    } finally {
      setSavingLater(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const subtotal = cart?.item_subtotal ?? cart?.subtotal ?? 0
  const taxTotal = cart?.tax_total ?? 0
  const total = cart?.total ?? 0
  const canOrderOnline = Boolean(cart && items.length > 0)

  return (
    <div
      id="shopping-list-print-root"
      className="print:bg-white print:p-4"
    >
      <div className="grid grid-cols-1 gap-10 small:grid-cols-[1fr_380px] small:gap-x-12">
        <div>
          <Heading
            level="h1"
            className="text-center text-3xl font-bold text-ui-fg-base mb-6"
          >
            My Shopping List
          </Heading>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 print:hidden">
            <button
              type="button"
              className={toolbarBtnClass}
              disabled={!items.length || emptying}
              onClick={() => void handleEmptyList()}
              data-testid="shopping-list-empty"
            >
              {emptying ? (
                <Spinner className="h-5 w-5 animate-spin" />
              ) : (
                <Trash className="h-5 w-5 shrink-0" />
              )}
              Empty List
            </button>
            <button
              type="button"
              className={toolbarBtnClass}
              disabled={!items.length || savingLater}
              onClick={() => void handleSaveForLater()}
              data-testid="shopping-list-save-later"
            >
              {savingLater ? (
                <Spinner className="h-5 w-5 animate-spin" />
              ) : (
                <ListForLaterIcon className="h-5 w-5 shrink-0" />
              )}
              Save for Later
            </button>
            <button
              type="button"
              className={toolbarBtnClass}
              onClick={handlePrint}
              data-testid="shopping-list-print"
            >
              <PrintIcon className="h-5 w-5 shrink-0" />
              Print
            </button>
          </div>

          <div className="mb-6 flex justify-center print:hidden">
            <div className="inline-flex rounded-full border border-ui-border-base bg-ui-bg-subtle/40 p-1">
              <button
                type="button"
                onClick={() => setView("department")}
                className={clx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  view === "department"
                    ? "bg-header-red text-white"
                    : "text-ui-fg-base hover:bg-white"
                )}
              >
                View by Department
              </button>
              <button
                type="button"
                onClick={() => setView("location")}
                className={clx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  view === "location"
                    ? "bg-header-red text-white"
                    : "text-ui-fg-base hover:bg-white"
                )}
              >
                View by Location
              </button>
            </div>
          </div>

          <div className="hidden small:grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-ui-border-base pb-2 text-right text-sm font-medium text-ui-fg-subtle print:grid">
            <span className="text-left pl-[7.5rem]">Item</span>
            <span className="w-24">Price</span>
            <span className="w-28">Unit Price</span>
            <span className="w-28 pr-2">Total Price</span>
          </div>

          <div className="flex flex-col gap-8">
            {!items.length ? (
              <div className="rounded-lg border border-dashed border-ui-border-base bg-ui-bg-subtle/30 px-6 py-16 text-center">
                <Text className="text-ui-fg-subtle">
                  Your list is empty. Browse the store to add products.
                </Text>
                <LocalizedClientLink
                  href="/store"
                  className="mt-4 inline-block text-sm font-semibold text-header-red hover:underline"
                >
                  Continue shopping
                </LocalizedClientLink>
              </div>
            ) : (
              groups.map(({ key, items: groupItems }) => (
                <section key={key}>
                  <div className="mb-3 rounded-md bg-ui-bg-subtle px-3 py-2 text-sm font-medium text-ui-fg-subtle">
                    {key}
                  </div>
                  <ul className="flex flex-col gap-6">
                    {groupItems.map((item) => {
                      const loc = locationGroupLabelForLineItem(item)
                      const note =
                        notes[item.id] ??
                        getLineNote(item.metadata) ??
                        ""
                      return (
                        <li
                          key={item.id}
                          className="border-b border-ui-border-base pb-6 last:border-0"
                        >
                          <div className="flex flex-col gap-4 small:flex-row small:items-start">
                            <div className="flex gap-4 min-w-0 flex-1">
                              <LocalizedClientLink
                                href={`/products/${item.product_handle}`}
                                className="shrink-0 w-20"
                              >
                                <Thumbnail
                                  thumbnail={item.thumbnail}
                                  images={item.variant?.product?.images}
                                  size="square"
                                  imageFit="contain"
                                />
                              </LocalizedClientLink>
                              <div className="min-w-0 flex-1">
                                <LocalizedClientLink
                                  href={`/products/${item.product_handle}`}
                                  className="text-base font-semibold text-header-red hover:underline line-clamp-2"
                                >
                                  {item.product_title ?? item.title}
                                </LocalizedClientLink>
                                <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-900">
                                  {loc}
                                </span>
                                <label className="mt-3 block print:hidden">
                                  <span className="sr-only">Note</span>
                                  <input
                                    type="text"
                                    placeholder="Enter a note"
                                    value={note}
                                    disabled={savingNoteId === item.id}
                                    onChange={(e) =>
                                      setNotes((prev) => ({
                                        ...prev,
                                        [item.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      const initial =
                                        getLineNote(item.metadata) ?? ""
                                      if (note === initial) return
                                      void persistNote(item.id, note)
                                    }}
                                    className="w-full max-w-md rounded-md border border-ui-border-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted"
                                  />
                                </label>
                              </div>
                            </div>

                            <div className="flex flex-col items-stretch gap-4 small:items-end">
                              <div className="grid grid-cols-3 gap-3 text-sm text-right">
                                <div>
                                  <Text className="mb-0.5 block text-left text-xs text-ui-fg-muted small:text-right">
                                    Price
                                  </Text>
                                  <LineItemUnitPrice
                                    item={item}
                                    style="tight"
                                    currencyCode={currencyCode}
                                  />
                                </div>
                                <div>
                                  <Text className="mb-0.5 block text-xs text-ui-fg-muted">
                                    Unit Price
                                  </Text>
                                  <div className="flex flex-col items-end">
                                    <LineItemUnitPrice
                                      item={item}
                                      style="tight"
                                      currencyCode={currencyCode}
                                    />
                                    <span className="text-xs text-ui-fg-muted">
                                      per item
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <Text className="mb-0.5 block text-xs text-ui-fg-muted">
                                    Total Price
                                  </Text>
                                  <LineItemPrice
                                    item={item}
                                    style="tight"
                                    currencyCode={currencyCode}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 print:hidden">
                                <QuantityControl item={item} />
                                <RemoveLineButton lineId={item.id} />
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>

        <aside className="small:sticky small:top-24 h-fit rounded-lg border border-ui-border-base bg-white p-6 shadow-sm print:hidden">
          <Heading level="h2" className="text-xl font-bold mb-4">
            List Summary
          </Heading>
          <Text className="text-sm text-ui-fg-subtle mb-4">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </Text>
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ui-fg-subtle">Order Value</span>
              <span className="font-medium">
                {convertToLocale({
                  amount: subtotal,
                  currency_code: currencyCode,
                  fromMinorUnit: true,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ui-fg-subtle">Store Tax</span>
              <span className="font-medium">
                {convertToLocale({
                  amount: taxTotal,
                  currency_code: currencyCode,
                  fromMinorUnit: true,
                })}
              </span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-ui-border-base pt-4 text-base font-bold">
            <span>Total (Estimated):</span>
            <span>
              {convertToLocale({
                amount: total,
                currency_code: currencyCode,
                fromMinorUnit: true,
              })}
            </span>
          </div>
          <Button
            type="button"
            className="mt-6 w-full bg-header-red text-white font-bold hover:opacity-95"
            size="large"
            disabled={!canOrderOnline}
            onClick={() => setModalOpen(true)}
            data-testid="order-online-button"
          >
            Order Online
          </Button>
          <Text className="mt-3 text-xs text-ui-fg-muted text-center">
            Choose Shop for Delivery to place your order for delivery.
          </Text>
        </aside>
      </div>

      {cart ? (
        <CheckoutMethodModal
          isOpen={modalOpen}
          close={() => setModalOpen(false)}
          customer={customer}
          cart={cart}
          checkoutStep="address"
          deliveryOnly
        />
      ) : null}
    </div>
  )
}

function RemoveLineButton({ lineId }: { lineId: string }) {
  const router = useRouter()
  const { refetchCart } = useCart() ?? {}
  const [deleting, setDeleting] = useState(false)

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={async () => {
        setDeleting(true)
        try {
          await deleteLineItem(lineId)
          await refetchCart?.()
          dispatchCartUpdated()
          router.refresh()
        } finally {
          setDeleting(false)
        }
      }}
      className="p-2 text-ui-fg-muted hover:text-ui-fg-base"
      aria-label="Remove from list"
      data-testid="shopping-list-remove"
    >
      {deleting ? (
        <Spinner className="h-5 w-5 animate-spin" />
      ) : (
        <Trash className="h-5 w-5" />
      )}
    </button>
  )
}

function QuantityControl({ item }: { item: HttpTypes.StoreCartLineItem }) {
  const router = useRouter()
  const { refetchCart } = useCart() ?? {}
  const [busy, setBusy] = useState(false)

  const bump = async (next: number) => {
    if (next < 1) return
    setBusy(true)
    try {
      await updateLineItem({ lineId: item.id, quantity: next })
      await refetchCart?.()
      dispatchCartUpdated()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border-2 border-header-red px-1 py-0.5">
      <button
        type="button"
        disabled={busy || item.quantity <= 1}
        onClick={() => void bump((item.quantity ?? 1) - 1)}
        className="flex h-8 w-8 items-center justify-center rounded text-header-red disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">
        {item.quantity}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void bump((item.quantity ?? 1) + 1)}
        className="flex h-8 w-8 items-center justify-center rounded text-header-red disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
