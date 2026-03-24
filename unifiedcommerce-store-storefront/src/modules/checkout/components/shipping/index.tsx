"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import {
  setShippingMethod,
  setCartCheckoutFulfillment,
} from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, clx, Heading, Text } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import CheckoutPickupStorePicker from "@modules/checkout/components/checkout-pickup-store-picker"
import CheckoutPickupSlotPicker from "@modules/checkout/components/checkout-pickup-slot-picker"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { StoreLocation } from "@modules/layout/components/delivery-location/store-finder-data"
import { resolvePickupOptionsForLocator } from "@modules/checkout/util/match-pickup-shipping-option"

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

/** Home-delivery option to preselect when `?shipping=standard` is present (shop-for-delivery handoff). */
function resolveStandardShippingOption(
  methods: HttpTypes.StoreCartShippingOption[] | null | undefined
): HttpTypes.StoreCartShippingOption | null {
  if (!methods?.length) return null
  const byStandard = methods.find((m) => /standard/i.test(m.name ?? ""))
  if (byStandard) return byStandard
  const nonExpress = methods.find((m) => !/express/i.test(m.name ?? ""))
  return nonExpress ?? null
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)
  const [pickupStep, setPickupStep] = useState<"store" | "slot" | "done">(
    "store"
  )
  const [pickupStoreLocatorId, setPickupStoreLocatorId] = useState<
    string | null
  >(null)

  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    cart.shipping_methods?.at(-1)?.shipping_option_id || null
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const { pickupOptions: _pickupMethodsResolved } =
    resolvePickupOptionsForLocator(availableShippingMethods ?? [])
  const pickupOptionIds = new Set(_pickupMethodsResolved.map((o) => o.id))

  const _pickupMethods = _pickupMethodsResolved

  const _shippingMethods = availableShippingMethods?.filter(
    (sm) => !pickupOptionIds.has(sm.id)
  )

  const hasPickupOptions = !!_pickupMethods?.length

  const standardPrefillDoneRef = useRef(false)
  const fulfillmentPickupSyncedRef = useRef(false)

  const cartMeta = cart.metadata as Record<string, unknown> | undefined
  const hasPickupSlotSaved = Boolean(cartMeta?.pickup_slot_date_iso)
  const isCurrentMethodPickup = Boolean(
    shippingMethodId &&
      _pickupMethods?.some((m) => m.id === shippingMethodId)
  )

  useEffect(() => {
    setShippingMethodId(
      cart.shipping_methods?.at(-1)?.shipping_option_id ?? null
    )
  }, [cart.shipping_methods])

  useEffect(() => {
    setIsLoadingPrices(true)

    if (_shippingMethods?.length) {
      const promises = _shippingMethods
        .filter((sm) => sm.price_type === "calculated")
        .map((sm) => calculatePriceForShippingOption(sm.id, cart.id))

      if (promises.length) {
        Promise.allSettled(promises).then((res) => {
          const pricesMap: Record<string, number> = {}
          res
            .filter((r) => r.status === "fulfilled")
            .forEach((p) => (pricesMap[p.value?.id || ""] = p.value?.amount!))

          setCalculatedPricesMap(pricesMap)
          setIsLoadingPrices(false)
        })
      } else {
        setIsLoadingPrices(false)
      }
    } else {
      setIsLoadingPrices(false)
    }

    if (_pickupMethods?.find((m) => m.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [availableShippingMethods])

  /** Restore pickup mode from cart metadata after refresh (do not force OFF here — avoids racing before `setCartCheckoutFulfillment("pickup")` completes). */
  useEffect(() => {
    if (cartMeta?.checkout_fulfillment === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [cartMeta?.checkout_fulfillment])

  /** Deep-link: checkout from "Shop for pickup" modal */
  useEffect(() => {
    if (!isOpen || searchParams.get("fulfillment") !== "pickup") return
    if (fulfillmentPickupSyncedRef.current) return
    fulfillmentPickupSyncedRef.current = true
    setShowPickupOptions(PICKUP_OPTION_ON)
    setPickupStep("store")
    void setCartCheckoutFulfillment("pickup")
    router.replace(pathname + "?step=delivery", { scroll: false })
  }, [isOpen, searchParams, pathname, router])

  /** Sync pickup step from cart (e.g. after refresh) */
  useEffect(() => {
    if (showPickupOptions !== PICKUP_OPTION_ON) {
      setPickupStep("store")
      return
    }
    if (hasPickupSlotSaved && isCurrentMethodPickup) {
      setPickupStep("done")
      return
    }
    if (isCurrentMethodPickup && !hasPickupSlotSaved) {
      setPickupStep("slot")
      return
    }
    setPickupStep("store")
  }, [
    showPickupOptions,
    hasPickupSlotSaved,
    isCurrentMethodPickup,
  ])

  /** After shop-for-delivery: Standard shipping prefill (not when user chose pickup checkout). */
  useEffect(() => {
    if (!isOpen) {
      standardPrefillDoneRef.current = false
      return
    }
    if (searchParams.get("shipping") !== "standard") return
    if (searchParams.get("fulfillment") === "pickup") return

    const standard = resolveStandardShippingOption(_shippingMethods)
    if (!standard) {
      if (_shippingMethods?.length) {
        standardPrefillDoneRef.current = true
        router.replace(pathname + "?step=delivery", { scroll: false })
      }
      return
    }

    if (standard.price_type === "calculated") {
      if (isLoadingPrices) return
      if (typeof calculatedPricesMap[standard.id] !== "number") return
    }

    if (shippingMethodId === standard.id) {
      standardPrefillDoneRef.current = true
      if (searchParams.get("shipping")) {
        router.replace(pathname + "?step=delivery", { scroll: false })
      }
      return
    }

    if (standardPrefillDoneRef.current) return
    standardPrefillDoneRef.current = true

    setShowPickupOptions(PICKUP_OPTION_OFF)
    setIsLoading(true)
    setShippingMethodId(standard.id)
    setShippingMethod({ cartId: cart.id, shippingMethodId: standard.id })
      .then(() => {
        router.replace(pathname + "?step=delivery", { scroll: false })
        router.refresh()
      })
      .catch((err: Error) => {
        setError(err.message)
        standardPrefillDoneRef.current = false
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [
    isOpen,
    searchParams,
    _shippingMethods,
    calculatedPricesMap,
    isLoadingPrices,
    shippingMethodId,
    cart.id,
    pathname,
    router,
  ])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup"
  ) => {
    setError(null)

    if (variant === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    } else {
      setShowPickupOptions(PICKUP_OPTION_OFF)
      await setCartCheckoutFulfillment("delivery")
    }

    let currentId: string | null = null
    setIsLoading(true)
    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })

    await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
      .catch((err) => {
        setShippingMethodId(currentId)

        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const handleSelectPickupStore = async (
    store: StoreLocation,
    option: HttpTypes.StoreCartShippingOption
  ) => {
    setError(null)
    setPickupStoreLocatorId(store.id)
    setIsLoading(true)
    setShippingMethodId(option.id)
    try {
      await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: option.id,
      })
      setShowPickupOptions(PICKUP_OPTION_ON)
      setPickupStep("slot")
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? "Could not set pickup location.")
    } finally {
      setIsLoading(false)
    }
  }

  const pickupFulfillmentActive = showPickupOptions === PICKUP_OPTION_ON
  /** After a pickup slot is saved, keep store pickup and block switching to home delivery. */
  const pickupFlowLocked =
    pickupFulfillmentActive &&
    hasPickupSlotSaved &&
    isCurrentMethodPickup
  const canContinueToPayment =
    Boolean(cart.shipping_methods?.[0]) &&
    (!pickupFulfillmentActive ||
      (isCurrentMethodPickup && hasPickupSlotSaved))

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && cart.shipping_methods?.length === 0,
            }
          )}
        >
          Delivery
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
            <CheckCircleSolid />
          )}
        </Heading>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <Text>
              <button
                onClick={handleEdit}
                className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                data-testid="edit-delivery-button"
              >
                Edit
              </button>
            </Text>
          )}
      </div>
      {isOpen ? (
        <>
          <div className="grid">
            <div className="flex flex-col">
              <span className="font-medium txt-medium text-ui-fg-base">
                Shipping method
              </span>
              <span className="mb-4 text-ui-fg-muted txt-medium">
                How would you like your order fulfilled
              </span>
            </div>
            <div data-testid="delivery-options-container">
              <div className="pb-8 md:pt-0 pt-2">
                {hasPickupOptions && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={showPickupOptions === PICKUP_OPTION_ON}
                    data-testid="delivery-option-pickup-toggle"
                    disabled={pickupFlowLocked}
                    onClick={async () => {
                      if (pickupFlowLocked) return
                      setShowPickupOptions(PICKUP_OPTION_ON)
                      setPickupStep("store")
                      setPickupStoreLocatorId(null)
                      await setCartCheckoutFulfillment("pickup")
                    }}
                    className={clx(
                      "group w-full text-left flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                      {
                        "border-ui-border-interactive":
                          showPickupOptions === PICKUP_OPTION_ON,
                        "opacity-60 cursor-not-allowed": pickupFlowLocked,
                      }
                    )}
                  >
                    <div className="flex items-center gap-x-4">
                      <MedusaRadio
                        checked={showPickupOptions === PICKUP_OPTION_ON}
                      />
                      <span className="text-base-regular">Shop for pickup</span>
                    </div>
                    <span className="justify-self-end text-ui-fg-base">—</span>
                  </button>
                )}
                <div
                  className={clx(
                    pickupFulfillmentActive && !pickupFlowLocked && "opacity-50",
                    pickupFlowLocked && "opacity-50 pointer-events-none"
                  )}
                >
                  <RadioGroup
                    value={shippingMethodId ?? ""}
                    onChange={(v) => {
                      if (pickupFlowLocked) return
                      if (v) {
                        return handleSetShippingMethod(v, "shipping")
                      }
                    }}
                  >
                    {_shippingMethods?.map((option) => {
                      const isDisabled =
                        option.price_type === "calculated" &&
                        !isLoadingPrices &&
                        typeof calculatedPricesMap[option.id] !== "number"

                      return (
                        <Radio
                          key={option.id}
                          value={option.id}
                          data-testid="delivery-option-radio"
                          disabled={isDisabled || pickupFlowLocked}
                          className={clx(
                            "group flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                            {
                              "border-ui-border-interactive":
                                option.id === shippingMethodId &&
                                !pickupFulfillmentActive,
                              "hover:shadow-brders-none cursor-not-allowed":
                                isDisabled,
                            }
                          )}
                        >
                          <div className="flex items-center gap-x-4">
                            <MedusaRadio
                              checked={
                                !pickupFulfillmentActive &&
                                option.id === shippingMethodId
                              }
                            />
                            <span className="text-base-regular">
                              {option.name}
                            </span>
                          </div>
                          <span className="justify-self-end text-ui-fg-base">
                            {option.price_type === "flat" ? (
                              convertToLocale({
                                amount: option.amount!,
                                currency_code: cart?.currency_code,
                                fromMinorUnit: true,
                              })
                            ) : calculatedPricesMap[option.id] ? (
                              convertToLocale({
                                amount: calculatedPricesMap[option.id],
                                currency_code: cart?.currency_code,
                                fromMinorUnit: true,
                              })
                            ) : isLoadingPrices ? (
                              <Loader />
                            ) : (
                              "-"
                            )}
                          </span>
                        </Radio>
                      )
                    })}
                  </RadioGroup>
                </div>
                {pickupFulfillmentActive && (
                  <p className="text-xs text-ui-fg-muted -mt-2 mb-2">
                    {pickupFlowLocked
                      ? "Store pickup and time are set. Use Edit on Delivery to change your method."
                      : "Pickup is selected: find a store and choose a pickup time. To use home delivery instead, select a shipping option below."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && hasPickupOptions && (
            <div className="grid gap-4 border-t border-ui-border-base pt-6 mt-2">
              {pickupStep === "store" && (
                <>
                  <div className="flex flex-col">
                    <span className="font-medium txt-medium text-ui-fg-base">
                      Find a store
                    </span>
                    <span className="mb-2 text-ui-fg-muted txt-medium text-sm">
                      Search by ZIP, city, or state. Select a store on the map or
                      from the list.
                    </span>
                  </div>
                  <CheckoutPickupStorePicker
                    pickupMethods={_pickupMethods}
                    selectedStoreLocatorId={pickupStoreLocatorId}
                    onSelectStoreForPickup={handleSelectPickupStore}
                  />
                </>
              )}

              {pickupStep === "slot" && (
                <CheckoutPickupSlotPicker
                  onComplete={() => {
                    setPickupStep("done")
                    router.push(pathname + "?step=payment", { scroll: false })
                    router.refresh()
                  }}
                />
              )}

              {pickupStep === "done" && hasPickupSlotSaved && (
                <Text className="text-small-regular text-ui-fg-subtle">
                  Pickup time saved. You can continue to payment.
                </Text>
              )}
            </div>
          )}

          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              size="large"
              className="mt"
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={!canContinueToPayment}
              data-testid="submit-delivery-option-button"
            >
              Continue to payment
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Method
                </Text>
                <Text className="txt-medium text-ui-fg-subtle">
                  {cart.shipping_methods!.at(-1)!.name}{" "}
                  {convertToLocale({
                    amount: cart.shipping_methods!.at(-1)!.amount!,
                    currency_code: cart?.currency_code,
                    fromMinorUnit: true,
                  })}
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
