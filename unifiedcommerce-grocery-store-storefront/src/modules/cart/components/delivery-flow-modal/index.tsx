"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, Text, Switch } from "@medusajs/ui"
import { Calendar } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Modal from "@modules/common/components/modal"
import Input from "@modules/common/components/input"
import AddressSelect from "@modules/checkout/components/address-select"
import CountrySelect from "@modules/checkout/components/country-select"
import { useParams, useRouter } from "next/navigation"
import { clx } from "@medusajs/ui"
import { mapKeys } from "lodash"
import { geocodeQuery } from "@modules/layout/components/delivery-location/geocode"
import {
  getNearestStores,
  getNearestStoresWithinRadius,
  type StoreLocation,
} from "@modules/layout/components/delivery-location/store-finder-data"
import { getStoreLocations } from "@lib/data/store-locations"
import {
  setDeliveryAddressAndStore,
  type DeliveryAddressInput,
  type DeliverySlotInput,
} from "@lib/data/cart"
import {
  getDeliveryDayOptions,
  getDeliveryTimeSlotsForDate,
  formatSlotPrice,
  isTodayNoSlotsAvailable,
  RESERVATION_HOLD_HOURS,
  type DeliveryTimeSlot,
  type DayOption,
} from "@modules/cart/utils/delivery-time-slots"

const BRAND_GREEN = "#006F46"
const TOP_STORES_LIMIT = 5
const STORE_RADIUS_MILES = 5

type DeliveryFlowModalProps = {
  isOpen: boolean
  close: () => void
  customer: HttpTypes.StoreCustomer | null
  cart: (HttpTypes.StoreCart & { region?: HttpTypes.StoreRegion; metadata?: Record<string, unknown> }) | null
  checkoutStep: string
  onSuccess?: () => void
  /** When opening from checkout "Change Store" / "Change timeslot", open at this step and prefill from cart */
  initialStep?: 1 | 2 | 3 | 4
}

const initialFormState: Record<string, string> = {
  "shipping_address.first_name": "",
  "shipping_address.last_name": "",
  "shipping_address.address_1": "",
  "shipping_address.company": "",
  "shipping_address.postal_code": "",
  "shipping_address.city": "",
  "shipping_address.country_code": "us",
  "shipping_address.province": "",
  "shipping_address.phone": "",
  email: "",
}

function formToAddress(formData: Record<string, string>): DeliveryAddressInput {
  return {
    first_name: formData["shipping_address.first_name"] || "",
    last_name: formData["shipping_address.last_name"] || "",
    address_1: formData["shipping_address.address_1"] || "",
    city: formData["shipping_address.city"] || "",
    postal_code: formData["shipping_address.postal_code"] || "",
    country_code: formData["shipping_address.country_code"] || "us",
    province: formData["shipping_address.province"] || "",
    phone: formData["shipping_address.phone"] || "",
    company: formData["shipping_address.company"] || "",
  }
}

export default function DeliveryFlowModal({
  isOpen,
  close,
  customer,
  cart,
  checkoutStep,
  onSuccess,
  initialStep: initialStepProp,
}: DeliveryFlowModalProps) {
  const router = useRouter()
  const { countryCode } = useParams()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [formData, setFormData] = useState<Record<string, string>>(initialFormState)
  const [selectedAddress, setSelectedAddress] = useState<HttpTypes.StoreCustomerAddress | null>(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [topStores, setTopStores] = useState<StoreLocation[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<DeliveryTimeSlot | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayOption | null>(null)
  const [showOnlyAvailableTimes, setShowOnlyAvailableTimes] = useState(true)
  const [contactPhone, setContactPhone] = useState("")
  const [orderInstructions, setOrderInstructions] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dayOptions = useMemo(() => getDeliveryDayOptions(), [])
  const selectedDayOption = selectedDay ?? dayOptions[0] ?? null
  const timeSlots = useMemo(
    () =>
      selectedDayOption
        ? getDeliveryTimeSlotsForDate(selectedDayOption.date, showOnlyAvailableTimes)
        : [],
    [selectedDayOption, showOnlyAvailableTimes]
  )

  const region = cart?.region
  const countriesInRegion = region?.countries?.map((c) => c.iso_2) ?? []
  const addressesInRegion =
    customer?.addresses?.filter(
      (a) => a.country_code && countriesInRegion.includes(a.country_code)
    ) ?? []
  const hasSavedAddresses = addressesInRegion.length > 0

  // Set initial day when step 3 is first shown
  useEffect(() => {
    if (step === 3 && !selectedDay && dayOptions.length > 0) {
      setSelectedDay(dayOptions[0])
    }
  }, [step, selectedDay, dayOptions])

  // Pre-fill contact phone on step 4 from cart/customer/address if empty
  useEffect(() => {
    if (step === 4 && !contactPhone) {
      const phone =
        cart?.shipping_address?.phone ||
        selectedAddress?.phone ||
        formData["shipping_address.phone"] ||
        ""
      if (phone) setContactPhone(phone)
    }
  }, [step, contactPhone, cart, selectedAddress, formData])

  // Reset state when modal opens; optionally open at initialStep 2 or 3 with prefilled data from cart
  useEffect(() => {
    if (isOpen) {
      const meta = cart?.metadata as Record<string, string> | undefined
      const startStep = initialStepProp ?? 1
      setError(null)
      setContactPhone(cart?.shipping_address?.phone ?? "")
      setOrderInstructions((meta?.order_instructions as string) ?? "")

      setFormData({
        ...initialFormState,
        "shipping_address.country_code": (countryCode as string) || "us",
        ...(cart?.shipping_address && {
          "shipping_address.first_name": cart.shipping_address.first_name || "",
          "shipping_address.last_name": cart.shipping_address.last_name || "",
          "shipping_address.address_1": cart.shipping_address.address_1 || "",
          "shipping_address.postal_code": cart.shipping_address.postal_code || "",
          "shipping_address.city": cart.shipping_address.city || "",
          "shipping_address.country_code": cart.shipping_address.country_code || "",
          "shipping_address.province": cart.shipping_address.province || "",
          "shipping_address.phone": cart.shipping_address.phone || "",
        }),
        ...(cart?.email && { email: cart.email }),
        ...(customer?.email && !cart?.email && { email: customer.email }),
      })
      setSelectedAddress(null)
      setUseNewAddress(!hasSavedAddresses)

      if (startStep === 2 || startStep === 3) {
        const storeFromMeta: StoreLocation = {
          id: meta?.delivery_store_id ?? "",
          name: meta?.delivery_store_name ?? "",
          address: (meta?.delivery_store_address ?? "").split(",")[0]?.trim() ?? "",
          city: "",
          state: "",
          zip: "",
          lat: 0,
          lng: 0,
        }
        const fullAddr = (meta?.delivery_store_address ?? "").split(",").map((s: string) => s.trim())
        if (fullAddr.length >= 2) storeFromMeta.city = fullAddr[1] ?? ""
        if (fullAddr.length >= 3) storeFromMeta.state = fullAddr[2] ?? ""
        if (fullAddr.length >= 4) storeFromMeta.zip = fullAddr[3] ?? ""
        setTopStores([storeFromMeta])
        setSelectedStore(storeFromMeta)
        setStep(2)
        if (startStep === 3 && meta?.delivery_slot_date_iso && meta?.delivery_slot_start && meta?.delivery_slot_end) {
          const dateIso = meta.delivery_slot_date_iso
          const slotDate = new Date(dateIso + "T12:00:00")
          const dayOpt = getDeliveryDayOptions().find((d) => d.dateKey === dateIso)
          if (dayOpt) setSelectedDay(dayOpt)
          const slot: DeliveryTimeSlot = {
            id: meta.delivery_slot_id ?? "",
            date: slotDate,
            startTime: meta.delivery_slot_start,
            endTime: meta.delivery_slot_end,
            label: `${meta.delivery_slot_start} - ${meta.delivery_slot_end}`,
            dateLabel: meta.delivery_slot_date_label ?? dayOpt?.label ?? "",
            priceCents: 999,
            slotsLeft: 4,
            isAvailable: true,
          }
          setSelectedSlot(slot)
          setStep(3)
        }
      } else {
        setStep(1)
        setTopStores([])
        setSelectedStore(null)
        setSelectedSlot(null)
        setSelectedDay(null)
      }
    }
  }, [isOpen, countryCode, cart, customer, hasSavedAddresses, initialStepProp])

  const setFormAddress = useCallback(
    (address?: HttpTypes.StoreCartAddress, email?: string) => {
      if (address) {
        setFormData((prev) => ({
          ...prev,
          "shipping_address.first_name": address.first_name || "",
          "shipping_address.last_name": address.last_name || "",
          "shipping_address.address_1": address.address_1 || "",
          "shipping_address.company": address.company || "",
          "shipping_address.postal_code": address.postal_code || "",
          "shipping_address.city": address.city || "",
          "shipping_address.country_code": address.country_code || "",
          "shipping_address.province": address.province || "",
          "shipping_address.phone": address.phone || "",
        }))
      }
      if (email) setFormData((prev) => ({ ...prev, email }))
    },
    []
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
      setError(null)
    },
    []
  )

  const getAddressForGeocode = useCallback((): { postal_code: string; country_code: string } | null => {
    if (selectedAddress?.postal_code) {
      return {
        postal_code: selectedAddress.postal_code,
        country_code: selectedAddress.country_code || (countryCode as string) || "us",
      }
    }
    const postal = formData["shipping_address.postal_code"]?.trim()
    const cc = formData["shipping_address.country_code"] || (countryCode as string) || "us"
    if (postal) return { postal_code: postal, country_code: cc }
    return null
  }, [selectedAddress, formData, countryCode])

  const goToStoreSelection = useCallback(async () => {
    const addr = getAddressForGeocode()
    if (!addr) {
      setError("Please select or enter a delivery address with a postal code.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const fullQuery = selectedAddress
        ? `${selectedAddress.address_1 || ""}, ${selectedAddress.city || ""}, ${selectedAddress.postal_code || ""}`.replace(/,\s*,/g, ",").trim()
        : `${formData["shipping_address.address_1"] || ""}, ${formData["shipping_address.city"] || ""}, ${formData["shipping_address.postal_code"] || ""}`.replace(/,\s*,/g, ",").trim()
      let result: Awaited<ReturnType<typeof geocodeQuery>> = null
      try {
        result = fullQuery ? await geocodeQuery(fullQuery, addr.country_code) : null
      } catch {
        result = null
      }
      if (!result && addr.postal_code) {
        try {
          result = await geocodeQuery(addr.postal_code, addr.country_code)
        } catch {
          result = null
        }
      }
      const lat = result?.lat ?? 39.8283
      const lng = result?.lng ?? -98.5795
      const apiStores = await getStoreLocations()
      const stores =
        apiStores.length > 0
          ? getNearestStoresWithinRadius(
              apiStores,
              lat,
              lng,
              STORE_RADIUS_MILES,
              TOP_STORES_LIMIT
            )
          : getNearestStores(lat, lng, TOP_STORES_LIMIT)
      setTopStores(stores)
      setSelectedStore(stores[0] ?? null)
      setStep(2)
    } catch {
      setError("Could not find location. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [getAddressForGeocode, selectedAddress, formData])

  const handleContinueToContactInfo = useCallback(() => {
    if (!selectedSlot) {
      setError("Please select a delivery time slot.")
      return
    }
    setError(null)
    const phone =
      contactPhone ||
      selectedAddress?.phone ||
      formData["shipping_address.phone"] ||
      cart?.shipping_address?.phone ||
      ""
    if (phone) setContactPhone(phone)
    setStep(4)
  }, [selectedSlot, contactPhone, selectedAddress, formData, cart])

  const handleContinueToPayAndPlaceOrder = useCallback(async () => {
    if (!selectedStore) {
      setError("Please select a store.")
      return
    }
    if (!selectedSlot) {
      setError("Please select a delivery time slot.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      let address: DeliveryAddressInput
      let email: string | undefined = formData.email || undefined
      if (selectedAddress && !useNewAddress) {
        address = {
          first_name: selectedAddress.first_name || "",
          last_name: selectedAddress.last_name || "",
          address_1: selectedAddress.address_1 || "",
          city: selectedAddress.city || "",
          postal_code: selectedAddress.postal_code || "",
          country_code: selectedAddress.country_code || "us",
          province: selectedAddress.province || "",
          phone: selectedAddress.phone || "",
          company: selectedAddress.company || "",
        }
        if (customer?.email) email = customer.email
      } else {
        address = formToAddress(formData)
        if (!address.postal_code || !address.address_1) {
          setError("Please complete the delivery address.")
          return
        }
      }
      const storePayload = {
        id: selectedStore.id,
        name: selectedStore.name,
        address: selectedStore.address,
        city: selectedStore.city,
        state: selectedStore.state,
        zip: selectedStore.zip,
      }
      const deliverySlotPayload: DeliverySlotInput = {
        slotId: selectedSlot.id,
        dateLabel: selectedSlot.dateLabel,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        dateIso: selectedSlot.date.toISOString().slice(0, 10),
      }
      const result = await setDeliveryAddressAndStore(address, storePayload, email, {
        deliverySlot: deliverySlotPayload,
        contactPhone: contactPhone.trim() || undefined,
        orderInstructions: orderInstructions.trim() || undefined,
      })
      if (result.success) {
        onSuccess?.()
        close()
        router.push(`/${countryCode}/checkout?step=payment`)
        router.refresh()
      } else {
        setError(result.error ?? "Something went wrong.")
      }
    } catch {
      setError("Failed to continue. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [
    selectedStore,
    selectedSlot,
    selectedAddress,
    useNewAddress,
    formData,
    contactPhone,
    orderInstructions,
    customer,
    close,
    router,
    countryCode,
    onSuccess,
  ])

  const addressInput = mapKeys(formData, (_, key) =>
    key.replace("shipping_address.", "")
  ) as unknown as HttpTypes.StoreCartAddress

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      size={step === 3 || step === 4 ? "large" : "medium"}
      data-testid="delivery-flow-modal"
    >
      <Modal.Title>
        <Text className="text-lg font-semibold" style={{ color: BRAND_GREEN }}>
          {step === 1 && "Delivery address"}
          {step === 2 && "Choose your store"}
          {step === 3 && "Choose a Shop delivery Time"}
          {step === 4 && "Contact Information & Order Instructions"}
        </Text>
      </Modal.Title>
      <Modal.Body>
        <div className="flex flex-col gap-4 py-2">
          {error && (
            <p className="text-small-regular text-ui-fg-error" role="alert">
              {error}
            </p>
          )}

          {step === 1 && (
            <>
              <Text className="text-small-regular" style={{ color: BRAND_GREEN }}>
                Select a saved address or enter a new delivery address. We’ll show you the top stores by inventory availability for that location.
              </Text>

              {hasSavedAddresses && (
                <div className="flex flex-col gap-2">
                  <Text className="text-small-medium" style={{ color: BRAND_GREEN }}>
                    Saved addresses
                  </Text>
                  <AddressSelect
                    addresses={customer!.addresses}
                    addressInput={addressInput}
                    onSelect={(addr) => {
                      setFormAddress(addr)
                      setSelectedAddress(addr ?? null)
                      setUseNewAddress(!addr)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseNewAddress(true)
                      setSelectedAddress(null)
                    }}
                    className="text-small-regular text-left text-ui-fg-interactive hover:underline"
                  >
                    Enter a new address
                  </button>
                </div>
              )}

              {(useNewAddress || !hasSavedAddresses) && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="First name"
                    name="shipping_address.first_name"
                    value={formData["shipping_address.first_name"]}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    label="Last name"
                    name="shipping_address.last_name"
                    value={formData["shipping_address.last_name"]}
                    onChange={handleChange}
                    required
                  />
                  <div className="col-span-2 w-full">
                    <Input
                      label="Address"
                      name="shipping_address.address_1"
                      value={formData["shipping_address.address_1"]}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <Input
                    label="Postal code"
                    name="shipping_address.postal_code"
                    value={formData["shipping_address.postal_code"]}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    label="City"
                    name="shipping_address.city"
                    value={formData["shipping_address.city"]}
                    onChange={handleChange}
                    required
                  />
                  {region && (
                    <div className="col-span-2 w-full">
                      <CountrySelect
                        name="shipping_address.country_code"
                        region={region}
                        value={formData["shipping_address.country_code"]}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  )}
                  <Input
                    label="State / Province"
                    name="shipping_address.province"
                    value={formData["shipping_address.province"]}
                    onChange={handleChange}
                  />
                  <Input
                    label="Phone"
                    name="shipping_address.phone"
                    value={formData["shipping_address.phone"]}
                    onChange={handleChange}
                  />
                  <div className="col-span-2 w-full">
                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Text className="text-small-regular" style={{ color: BRAND_GREEN }}>
                Nearest top {TOP_STORES_LIMIT} stores within {STORE_RADIUS_MILES} miles of your delivery address (by zip). Select one to continue.
              </Text>
              {topStores.length === 0 ? (
                <p className="text-small-regular text-ui-fg-muted py-4">
                  No stores found within {STORE_RADIUS_MILES} miles. Try a different delivery address or postal code.
                </p>
              ) : (
              <ul className="list-none flex flex-col gap-2">
                {topStores.map((store, i) => (
                  <li key={store.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStore(store)}
                      className={clx(
                        "w-full flex gap-3 p-3 rounded-md border text-left transition-colors",
                        selectedStore?.id === store.id
                          ? "border-ui-border-interactive ring-2 ring-ui-border-interactive bg-ui-bg-base"
                          : "bg-ui-bg-subtle border-ui-border-base hover:border-ui-border-strong"
                      )}
                      data-testid={`delivery-store-option-${store.id}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ui-bg-base text-ui-fg-base txt-compact-small-plus font-semibold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="txt-small-medium text-ui-fg-base font-medium">
                          {store.name}
                        </p>
                        <p className="txt-small text-ui-fg-muted">
                          {store.address}, {store.city}, {store.state} {store.zip}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center gap-2 text-small-regular text-ui-fg-subtle mb-2">
                <Calendar className="w-4 h-4" />
                <span>Please select a timeslot, your timeslot will be reserved for {RESERVATION_HOLD_HOURS} hours.</span>
              </div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <label className="flex items-center gap-2 text-small-regular cursor-pointer">
                  <Switch
                    checked={showOnlyAvailableTimes}
                    onCheckedChange={setShowOnlyAvailableTimes}
                  />
                  <span style={{ color: BRAND_GREEN }}>Show only available times</span>
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
                        ? { borderColor: BRAND_GREEN, color: BRAND_GREEN }
                        : undefined
                    }
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {selectedDayOption &&
                isTodayNoSlotsAvailable(selectedDayOption.date) && (
                  <div
                    className="p-4 rounded-md border border-ui-border-base bg-ui-bg-subtle text-small-regular text-ui-fg-muted"
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
                          ? "border-ui-border-interactive bg-green-50/50"
                          : "bg-ui-bg-subtle border-ui-border-base hover:border-ui-border-strong"
                      )}
                      style={
                        selectedSlot?.id === slot.id
                          ? { borderColor: BRAND_GREEN, backgroundColor: "rgba(0, 111, 70, 0.08)" }
                          : undefined
                      }
                      data-testid={`delivery-slot-${slot.id}`}
                    >
                      <span
                        className={clx(
                          "flex h-6 w-6 shrink-0 rounded-full border-2",
                          selectedSlot?.id === slot.id ? "border-current bg-current" : "border-ui-fg-muted"
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
                          selectedSlot?.id === slot.id ? "text-green-700" : "text-ui-fg-interactive"
                        )}
                        style={selectedSlot?.id === slot.id ? undefined : { color: BRAND_GREEN }}
                      >
                        {selectedSlot?.id === slot.id ? "Reserved" : "Select"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {selectedSlot && (
                <div
                  className="mt-4 p-3 rounded-md border border-green-200 bg-green-50/50 text-small-regular"
                  style={{ borderColor: BRAND_GREEN }}
                  role="status"
                >
                  <p className="font-medium text-ui-fg-base">
                    Your Delivery was reserved for {selectedSlot.dateLabel}, {selectedSlot.startTime} - {selectedSlot.endTime}
                  </p>
                  <p className="text-ui-fg-muted mt-1">
                    We will release this reservation if you have not placed your order before 1 hour 59 minutes.
                  </p>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <Text className="text-small-regular mb-2" style={{ color: BRAND_GREEN }}>
                Confirm your contact details and add any instructions for store associates.
              </Text>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-small-medium text-ui-fg-base mb-1">Phone number</label>
                  <Input
                    type="tel"
                    placeholder="Enter phone number"
                    value={contactPhone}
                    onChange={(e) => {
                      setContactPhone(e.target.value)
                      setError(null)
                    }}
                    className="w-full"
                  />
                  <p className="text-small-regular text-ui-fg-muted mt-1">
                    {cart?.shipping_address?.phone || customer?.phone
                      ? "Update or enter a new phone number for delivery updates."
                      : "Enter your phone number for delivery updates."}
                  </p>
                </div>
                <div>
                  <label className="block text-small-medium text-ui-fg-base mb-1">
                    Order instructions for store associates
                  </label>
                  <textarea
                    placeholder="e.g. Leave at door, ring the bell, gate code 1234..."
                    value={orderInstructions}
                    onChange={(e) => {
                      setOrderInstructions(e.target.value)
                      setError(null)
                    }}
                    rows={4}
                    className="w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-small-regular text-ui-fg-base placeholder:text-ui-fg-muted focus:border-ui-border-interactive focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="w-full flex justify-center items-center gap-2">
          {step === 1 && (
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                onClick={goToStoreSelection}
                disabled={loading}
                isLoading={loading}
                style={{ backgroundColor: BRAND_GREEN }}
                className="text-white hover:opacity-90"
                data-testid="delivery-flow-next"
              >
                Next
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!selectedStore}
                style={{ backgroundColor: BRAND_GREEN }}
                className="text-white hover:opacity-90"
                data-testid="delivery-flow-next"
              >
                Next
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={handleContinueToContactInfo}
                disabled={!selectedSlot}
                style={{ backgroundColor: BRAND_GREEN }}
                className="text-white hover:opacity-90"
                data-testid="delivery-flow-continue-contact"
              >
                Continue to Contact Information
              </Button>
            </>
          )}
          {step === 4 && (
            <>
              <Button variant="secondary" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                onClick={handleContinueToPayAndPlaceOrder}
                disabled={loading}
                isLoading={loading}
                style={{ backgroundColor: BRAND_GREEN }}
                className="text-white hover:opacity-90"
                data-testid="delivery-flow-continue-pay"
              >
                Continue to Pay and Place Order
              </Button>
            </>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  )
}
