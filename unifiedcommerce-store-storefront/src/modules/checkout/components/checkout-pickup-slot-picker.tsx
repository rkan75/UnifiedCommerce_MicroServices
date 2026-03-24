"use client"

import { useMemo, useState } from "react"
import { Calendar } from "@medusajs/icons"
import { Button, Switch, Text } from "@medusajs/ui"
import { clx } from "@medusajs/ui"
import {
  getDeliveryDayOptions,
  getDeliveryTimeSlotsForDate,
  formatSlotPrice,
  isTodayNoSlotsAvailable,
  RESERVATION_HOLD_HOURS,
  RESERVATION_WARNING_MINUTES,
  type DeliveryTimeSlot,
  type DayOption,
} from "@modules/cart/utils/delivery-time-slots"
import { setPickupTimeSlot } from "@lib/data/cart"
import { useRouter } from "next/navigation"

/** GNC header accent — matches `tailwind` `header.red`. */
const HEADER_RED = "#D10022"

type Variant = "embedded" | "page"

type CheckoutPickupSlotPickerProps = {
  onComplete: () => void
  variant?: Variant
  onBack?: () => void
  /** Required when `variant="page"` — used after saving to navigate to checkout. */
  countryCode?: string
  continueHrefStep?: "payment" | "delivery"
}

export default function CheckoutPickupSlotPicker({
  onComplete,
  variant = "embedded",
  onBack,
  countryCode,
  continueHrefStep = "delivery",
}: CheckoutPickupSlotPickerProps) {
  const router = useRouter()
  const isPage = variant === "page"

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayOption | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<DeliveryTimeSlot | null>(null)
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true)

  const dayOptions = useMemo(() => getDeliveryDayOptions(), [])
  const selectedDayOption = selectedDay ?? dayOptions[0] ?? null

  const timeSlots = useMemo(
    () =>
      selectedDayOption
        ? getDeliveryTimeSlotsForDate(selectedDayOption.date, showOnlyAvailable)
        : [],
    [selectedDayOption, showOnlyAvailable]
  )

  const persistSlot = async (): Promise<boolean> => {
    if (!selectedSlot) {
      setError("Please select a pickup time.")
      return false
    }
    setLoading(true)
    setError(null)
    try {
      const r = await setPickupTimeSlot({
        slotId: selectedSlot.id,
        dateLabel: selectedSlot.dateLabel,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        dateIso: selectedSlot.date.toISOString().slice(0, 10),
      })
      if (r.success) {
        router.refresh()
        return true
      }
      setError(r.error ?? "Could not save pickup time.")
      return false
    } catch {
      setError("Could not save pickup time.")
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleEmbeddedConfirm = async () => {
    const ok = await persistSlot()
    if (ok) onComplete()
  }

  const handlePageContinue = async () => {
    const ok = await persistSlot()
    if (!ok) return
    onComplete()
    if (countryCode) {
      const q =
        continueHrefStep === "delivery"
          ? "step=delivery&fulfillment=pickup"
          : `step=${continueHrefStep}`
      router.push(`/${countryCode}/checkout?${q}`)
    }
  }

  const slotBody = (
    <>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 text-small-regular text-ui-fg-subtle mb-2">
        <Calendar className="w-4 h-4 shrink-0" aria-hidden />
        <span>
          Please select a timeslot, your timeslot will be reserved for{" "}
          {RESERVATION_HOLD_HOURS} hours.
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <label className="flex items-center gap-2 text-small-regular cursor-pointer">
          <Switch checked={showOnlyAvailable} onCheckedChange={setShowOnlyAvailable} />
          <span className="text-header-red">Show only available times</span>
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" role="tablist">
        {dayOptions.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            onClick={() => {
              setSelectedDay(day)
              setSelectedSlot(null)
            }}
            className={clx(
              "shrink-0 px-3 py-2 rounded-md text-small-regular font-medium transition-colors",
              selectedDayOption?.dateKey === day.dateKey
                ? "bg-ui-bg-base border-2 border-ui-border-interactive text-ui-fg-base"
                : "bg-ui-bg-subtle border border-transparent text-ui-fg-muted hover:bg-ui-bg-base"
            )}
            style={
              selectedDayOption?.dateKey === day.dateKey
                ? { borderColor: HEADER_RED, color: HEADER_RED }
                : undefined
            }
          >
            {day.label}
          </button>
        ))}
      </div>

      {selectedDayOption && isTodayNoSlotsAvailable(selectedDayOption.date) && (
        <div
          className="p-4 rounded-md border border-ui-border-base bg-ui-bg-subtle text-small-regular text-ui-fg-muted mb-4"
          role="status"
        >
          Today no slot available. Select the next day for available slots (9 AM – 6 PM, 1 hour duration).
        </div>
      )}

      <ul className="list-none flex flex-col gap-2 max-h-64 overflow-y-auto">
        {timeSlots.map((slot) => (
          <li key={slot.id}>
            <button
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={clx(
                "w-full flex items-center gap-4 p-3 rounded-md border text-left transition-colors",
                selectedSlot?.id === slot.id
                  ? "border-header-red bg-red-50/80 text-header-red"
                  : "bg-ui-bg-subtle border-ui-border-base hover:border-ui-border-strong"
              )}
              data-testid={`pickup-slot-${slot.id}`}
            >
              <span
                className={clx(
                  "flex h-6 w-6 shrink-0 rounded-full border-2",
                  selectedSlot?.id === slot.id
                    ? "border-current bg-current"
                    : "border-ui-fg-muted"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="txt-small-medium text-ui-fg-base font-medium">{slot.label}</p>
                <p className="txt-small text-ui-fg-muted">
                  {slot.slotsLeft} Slots Left · {formatSlotPrice(slot.priceCents)}
                </p>
              </div>
              <span
                className={clx(
                  "txt-small-plus font-medium shrink-0",
                  selectedSlot?.id === slot.id
                    ? "text-header-red"
                    : "text-header-red/90"
                )}
              >
                {selectedSlot?.id === slot.id ? "Reserved" : "Select"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selectedSlot && (
        <div
          className="mt-4 p-3 rounded-md border border-header-red/25 bg-red-50/80 text-small-regular"
          role="status"
        >
          <p className="font-medium text-ui-fg-base">
            Your Store Pickup was reserved for {selectedSlot.dateLabel},{" "}
            {selectedSlot.startTime} - {selectedSlot.endTime}
          </p>
          <p className="text-ui-fg-muted mt-1">
            We will release this reservation if you have not placed your order before{" "}
            {Math.floor(RESERVATION_WARNING_MINUTES / 60)} hour{" "}
            {RESERVATION_WARNING_MINUTES % 60} minutes.
          </p>
        </div>
      )}
    </>
  )

  if (isPage) {
    return (
      <div className="flex flex-col gap-1">
        <Text className="text-lg font-semibold text-header-red">
          Choose a Store Pickup Time
        </Text>
        <div className="flex flex-col gap-4 py-2">{slotBody}</div>
        <div className="w-full flex justify-center items-center gap-2 pt-4 border-t border-ui-border-base mt-2">
          {onBack && (
            <Button type="button" variant="secondary" onClick={onBack}>
              Back
            </Button>
          )}
          <Button
            type="button"
            onClick={handlePageContinue}
            disabled={!selectedSlot || loading}
            isLoading={loading}
            className="text-white hover:opacity-90 bg-header-red"
            data-testid="pickup-slot-continue"
          >
            Continue to checkout
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 border-t border-ui-border-base pt-6 mt-2">
      <Text className="text-lg font-semibold text-header-red">
        Choose a Store Pickup Time
      </Text>
      {slotBody}
      <Button
        type="button"
        onClick={handleEmbeddedConfirm}
        isLoading={loading}
        disabled={!selectedSlot}
        className="w-full max-w-md text-white hover:opacity-90 bg-header-red"
        data-testid="pickup-slot-confirm"
      >
        Confirm pickup time
      </Button>
    </div>
  )
}
