"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Text } from "@medusajs/ui"
import CheckoutPickupSlotPicker from "@modules/checkout/components/checkout-pickup-slot-picker"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const HEADER_RED = "#D10022"

type PickupTimeslotTemplateProps = {
  countryCode: string
}

export default function PickupTimeslotTemplate({
  countryCode,
}: PickupTimeslotTemplateProps) {
  const router = useRouter()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-black/55 backdrop-blur-[2px] px-4 py-8 small:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pickup-timeslot-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-ui-border-base overflow-hidden flex flex-col max-h-[min(900px,calc(100dvh-4rem))]">
        <div
          className="shrink-0 px-5 small:px-8 pt-6 pb-2 border-b border-ui-border-base"
          style={{
            background: `linear-gradient(180deg, ${HEADER_RED}08 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Text
                id="pickup-timeslot-title"
                className="text-xl font-semibold mb-0.5 text-header-red"
              >
                Unified Commerce
              </Text>
              <Text className="text-small-regular text-ui-fg-muted max-w-md">
                Choose when you&apos;ll pick up your order at the store you
                selected.
              </Text>
            </div>
            <LocalizedClientLink
              href="/cart"
              className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-md border border-ui-border-base hover:bg-ui-bg-subtle text-header-red"
            >
              Close
            </LocalizedClientLink>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 small:px-8 py-6">
          <CheckoutPickupSlotPicker
            variant="page"
            countryCode={countryCode}
            continueHrefStep="payment"
            onBack={() => router.push(`/${countryCode}/pickup-store-locator`)}
            onComplete={() => {
              /* navigation handled inside picker after save */
            }}
          />
        </div>
      </div>
    </div>
  )
}
