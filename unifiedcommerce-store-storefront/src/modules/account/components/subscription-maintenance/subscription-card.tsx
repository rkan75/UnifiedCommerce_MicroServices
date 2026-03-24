"use client"

import Image from "next/image"

import { Text, Button } from "@medusajs/ui"
import { clx } from "@medusajs/ui"
import type { StoreSubscription } from "types/subscription"
import {
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  skipNextSubscriptionCycle,
} from "@lib/data/subscriptions"
import { useRouter } from "next/navigation"
import { useState } from "react"

function formatNextRun(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function intervalLabel(unit: string, count: number) {
  const u = count === 1 ? unit : `${unit}s`
  return `Every ${count} ${u}`
}

export default function SubscriptionCard({
  subscription,
}: {
  subscription: StoreSubscription
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(true)
    try {
      const r = await fn()
      if (r.ok) {
        router.refresh()
        return
      }
      const msg =
        r.error?.trim() ||
        "Could not update your subscription. Please try again."
      if (typeof window !== "undefined") {
        window.alert(msg)
      }
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(e instanceof Error ? e.message : "Request failed")
      }
    } finally {
      setPending(false)
    }
  }

  const item = subscription.items[0]
  const title =
    item?.product_title ||
    item?.variant_title ||
    "Subscription item"

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4 small:p-6">
      <div className="flex flex-col gap-4 small:flex-row small:items-start">
        {item?.thumbnail ? (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-subtle">
            <Image
              src={item.thumbnail}
              alt=""
              fill
              className="object-contain p-1"
              sizes="96px"
              unoptimized={/^https?:\/\//i.test(item.thumbnail)}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text className="text-lg font-semibold text-ui-fg-base">
              {title}
            </Text>
            <span
              className={clx(
                "rounded-full px-2 py-0.5 text-xs font-medium uppercase",
                subscription.status === "active" && "bg-green-100 text-green-900",
                subscription.status === "paused" && "bg-amber-100 text-amber-900",
                subscription.status === "past_due" && "bg-red-100 text-red-900",
                subscription.status === "cancelled" && "bg-grey-100 text-grey-700",
                subscription.status === "draft" && "bg-grey-100 text-grey-600"
              )}
            >
              {subscription.status.replace("_", " ")}
            </span>
          </div>
          <Text className="mt-1 text-sm text-ui-fg-muted">
            {intervalLabel(
              subscription.interval_unit,
              subscription.interval_count
            )}
            {" · "}
            {subscription.status === "draft" ? (
              <>
                Projected first refill (after checkout):{" "}
                <span className="font-medium text-ui-fg-base">
                  {formatNextRun(subscription.next_run_at)}
                </span>
              </>
            ) : subscription.status === "paused" && !subscription.next_run_at ? (
              <span className="font-medium text-ui-fg-base">
                Refills paused — no scheduled date until you resume
              </span>
            ) : (
              <>
                Next refill:{" "}
                <span className="font-medium text-ui-fg-base">
                  {formatNextRun(subscription.next_run_at)}
                </span>
              </>
            )}
          </Text>
          {subscription.status === "draft" ? (
            <Text className="mt-2 text-sm text-ui-fg-muted">
              Still in your cart — complete purchase to lock in Subscribe &amp; Save.
            </Text>
          ) : null}
          {subscription.shipping?.label ? (
            <Text className="mt-2 text-sm text-ui-fg-muted">
              Ship to: {subscription.shipping.label}
              {subscription.shipping.city
                ? `, ${subscription.shipping.city}`
                : ""}
            </Text>
          ) : null}
          {subscription.payment?.label ? (
            <Text className="mt-1 text-sm text-ui-fg-muted">
              Payment: {subscription.payment.label}
            </Text>
          ) : (
            <Text className="mt-1 text-sm text-amber-800">
              Add or update a saved payment method in checkout to keep
              refills active.
            </Text>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-ui-border-base pt-4">
        {subscription.status === "draft" ? (
          <Text className="text-sm text-ui-fg-muted">
            Pause, skip, and cancel apply after checkout.
          </Text>
        ) : null}
        {subscription.status === "active" ? (
          <>
            <Button
              variant="secondary"
              size="small"
              disabled={pending}
              onClick={() => void run(() => skipNextSubscriptionCycle(subscription.id))}
            >
              Skip next refill
            </Button>
            <Button
              variant="secondary"
              size="small"
              disabled={pending}
              onClick={() => void run(() => pauseSubscription(subscription.id))}
            >
              Pause
            </Button>
          </>
        ) : null}
        {subscription.status === "paused" ? (
          <Button
            variant="secondary"
            size="small"
            disabled={pending}
            onClick={() => void run(() => resumeSubscription(subscription.id))}
          >
            Resume
          </Button>
        ) : null}
        {subscription.status !== "cancelled" && subscription.status !== "draft" ? (
          <Button
            variant="secondary"
            size="small"
            className="border-red-200 text-red-700 hover:bg-red-50"
            disabled={pending}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "Cancel this subscription? Subscribe & Save will be turned off for this product and delivery schedule."
                )
              ) {
                return
              }
              void run(() => cancelSubscription(subscription.id))
            }}
          >
            Cancel subscription
          </Button>
        ) : null}
      </div>
    </div>
  )
}
