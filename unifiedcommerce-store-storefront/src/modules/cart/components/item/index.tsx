"use client"

import { Table, Text, clx } from "@medusajs/ui"
import { updateLineItem } from "@lib/data/cart"
import {
  DEFAULT_SHIP_EVERY_DAYS,
  isProductSubscribeEligible,
  isSubscribeSaveOptedOut,
  mergeSubscribeSaveIntoLineMetadata,
  parseSubscribeSaveFromLineMetadata,
  SHIP_EVERY_OPTIONS_DAYS,
} from "@lib/config/subscribe-save-metadata"
import { useSubscribeSaveOptOutKeys } from "@modules/common/components/subscribe-save-block-context"
import { HttpTypes } from "@medusajs/types"
import {
  dispatchCartUpdated,
  useCartActions,
} from "@modules/common/components/cart-provider"
import CartItemSelect from "@modules/cart/components/cart-item-select"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useEffect, useRef, useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
}

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cartActions = useCartActions()
  const subscribeOptOutKeys = useSubscribeSaveOptOutKeys()
  const clearedOptOutRef = useRef<string | null>(null)

  const subscribeSave = parseSubscribeSaveFromLineMetadata(
    item.metadata as Record<string, unknown> | null | undefined
  )
  const product = item.variant?.product as HttpTypes.StoreProduct | undefined
  const shipDaysForOptOut = subscribeSave?.shipEveryDays ?? DEFAULT_SHIP_EVERY_DAYS
  const subscribeBlocked =
    type === "full" &&
    Boolean(
      item.variant_id &&
        isSubscribeSaveOptedOut(
          subscribeOptOutKeys,
          item.variant_id,
          shipDaysForOptOut
        )
    )
  const subscribeEligible =
    type === "full" &&
    isProductSubscribeEligible(product) &&
    !subscribeBlocked

  const [subscribeChecked, setSubscribeChecked] = useState(
    () => !!subscribeSave
  )
  const [shipEveryDays, setShipEveryDays] = useState(
    () => subscribeSave?.shipEveryDays ?? DEFAULT_SHIP_EVERY_DAYS
  )

  useEffect(() => {
    const parsed = parseSubscribeSaveFromLineMetadata(
      item.metadata as Record<string, unknown> | null | undefined
    )
    setSubscribeChecked(!!parsed)
    setShipEveryDays(parsed?.shipEveryDays ?? DEFAULT_SHIP_EVERY_DAYS)
  }, [item.id, item.metadata])

  const persistSubscribeSave = async (checked: boolean, days: string) => {
    setError(null)
    setUpdating(true)
    const meta = mergeSubscribeSaveIntoLineMetadata(
      item.metadata as Record<string, unknown> | null | undefined,
      checked,
      days
    )
    try {
      await updateLineItem({
        lineId: item.id,
        quantity: item.quantity,
        metadata: meta,
      })
      await cartActions?.refetchCart()
      dispatchCartUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      const parsed = parseSubscribeSaveFromLineMetadata(
        item.metadata as Record<string, unknown> | null | undefined
      )
      setSubscribeChecked(!!parsed)
      setShipEveryDays(parsed?.shipEveryDays ?? DEFAULT_SHIP_EVERY_DAYS)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    if (type !== "full" || !subscribeBlocked || !subscribeSave) return
    const sig = `${item.id}:${shipDaysForOptOut}`
    if (clearedOptOutRef.current === sig) return
    clearedOptOutRef.current = sig
    void persistSubscribeSave(false, DEFAULT_SHIP_EVERY_DAYS)
    // persistSubscribeSave is stable enough for this one-shot; avoid effect loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, subscribeBlocked, subscribeSave, item.id, shipDaysForOptOut])

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setUpdating(false)
      })
    await cartActions?.refetchCart()
    dispatchCartUpdated()
  }

  // TODO: Update this to grab the actual max inventory
  const maxQtyFromInventory = 10
  const maxQuantity = item.variant?.manage_inventory ? 10 : maxQtyFromInventory

  const subscribeSectionVisible =
    type === "full" &&
    (subscribeEligible || !!subscribeSave || subscribeBlocked)

  return (
    <Table.Row
      className={clx(
        "w-full",
        subscribeSectionVisible && "[&_td]:!pb-2 [&_td]:align-top"
      )}
      data-testid="product-row"
    >
      <Table.Cell className="!pl-0 p-4 w-24">
        <LocalizedClientLink
          href={
            item.variant?.product?.is_giftcard
              ? "/gift-cards"
              : `/products/${item.product_handle}`
          }
          className={clx("flex", {
            "w-16": type === "preview",
            "small:w-24 w-12": type === "full",
          })}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
            imageFit="contain"
          />
        </LocalizedClientLink>
      </Table.Cell>

      <Table.Cell className="text-left">
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-title"
        >
          {item.product_title}
        </Text>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
        {subscribeEligible ? (
          <div className="mt-2 max-w-xs rounded-md border border-ui-border-base bg-ui-bg-subtle/40 px-2.5 py-2 mb-0">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-ui-border-base text-emerald-600 focus:ring-emerald-600"
                checked={subscribeChecked}
                disabled={updating}
                onChange={(e) => {
                  const checked = e.target.checked
                  setSubscribeChecked(checked)
                  const days = checked ? shipEveryDays : DEFAULT_SHIP_EVERY_DAYS
                  void persistSubscribeSave(checked, days)
                }}
                data-testid="cart-subscribe-save-checkbox"
              />
              <span className="text-sm font-semibold text-emerald-800">
                Subscribe to save
              </span>
            </label>
            {subscribeChecked ? (
              <div className="mt-2 pl-6">
                <label
                  htmlFor={`ship-every-${item.id}`}
                  className="mb-1 block text-xs font-semibold uppercase text-ui-fg-subtle"
                >
                  Ship every
                </label>
                <select
                  id={`ship-every-${item.id}`}
                  className="w-full max-w-[200px] rounded-md border border-ui-border-base bg-white px-2 py-1.5 text-sm text-ui-fg-base"
                  value={shipEveryDays}
                  disabled={updating}
                  onChange={(e) => {
                    const v = e.target.value
                    setShipEveryDays(v)
                    void persistSubscribeSave(true, v)
                  }}
                  data-testid="cart-ship-every-select"
                >
                  {SHIP_EVERY_OPTIONS_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : subscribeSave ? (
          <p
            className={clx(
              "mt-1 font-medium text-emerald-800",
              type === "preview" ? "text-[11px]" : "text-xs"
            )}
            data-testid="line-subscribe-save"
          >
            {type === "preview" ? (
              <>
                Subscribe &amp; save · every {subscribeSave.shipEveryDays} days
              </>
            ) : (
              <>
                Subscribe &amp; save — ships every {subscribeSave.shipEveryDays}{" "}
                days
              </>
            )}
          </p>
        ) : null}
      </Table.Cell>

      {type === "full" && (
        <Table.Cell>
          <div className="flex gap-2 items-center w-28">
            <DeleteButton id={item.id} data-testid="product-delete-button" />
            <CartItemSelect
              value={item.quantity}
              onChange={(value) => changeQuantity(parseInt(value.target.value))}
              className="w-14 h-10 p-4"
              data-testid="product-select-button"
            >
              {/* TODO: Update this with the v2 way of managing inventory */}
              {Array.from(
                {
                  length: Math.min(maxQuantity, 10),
                },
                (_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1}
                  </option>
                )
              )}
            </CartItemSelect>
            {updating && <Spinner />}
          </div>
          <ErrorMessage error={error} data-testid="product-error-message" />
        </Table.Cell>
      )}

      {type === "full" && (
        <Table.Cell className="hidden small:table-cell">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </Table.Cell>
      )}

      <Table.Cell className="!pr-0">
        <span
          className={clx("!pr-0", {
            "flex flex-col items-end h-full justify-center": type === "preview",
          })}
        >
          {type === "preview" && (
            <span className="flex gap-x-1 ">
              <Text className="text-ui-fg-muted">{item.quantity}x </Text>
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </span>
          )}
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
