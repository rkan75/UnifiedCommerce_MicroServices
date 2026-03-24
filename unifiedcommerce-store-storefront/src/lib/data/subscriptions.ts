"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { FetchError } from "@medusajs/js-sdk"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import type { ListSubscriptionsResponse, StoreSubscription } from "types/subscription"

const SUBSCRIPTIONS_PATH = "/store/customers/me/subscriptions"

function hasAuth(
  h: { authorization: string } | Record<string, never>
): h is { authorization: string } {
  return (
    typeof (h as { authorization?: string }).authorization === "string" &&
    Boolean((h as { authorization: string }).authorization?.trim())
  )
}

/**
 * Next parallel routes (@dashboard) sometimes keep stale RSC payload after router.refresh().
 * Revalidate the referer path + root layout so subscription mutations show up immediately.
 */
async function revalidateAfterSubscriptionMutation(): Promise<void> {
  try {
    const h = await headers()
    const referer = h.get("referer")
    if (referer) {
      const u = new URL(referer)
      revalidatePath(u.pathname)
    }
  } catch {
    // ignore
  }
  revalidatePath("/", "layout")
}

/**
 * Lists authenticated customer's subscriptions.
 */
export async function listCustomerSubscriptions(): Promise<StoreSubscription[]> {
  const headersIn = await getAuthHeaders()
  if (!hasAuth(headersIn)) return []

  try {
    const res = await sdk.client.fetch<ListSubscriptionsResponse>(
      SUBSCRIPTIONS_PATH,
      {
        method: "GET",
        headers: headersIn,
        cache: "no-store",
      }
    )
    return res.subscriptions ?? []
  } catch {
    return []
  }
}

async function postSubscriptionAction(
  subscriptionId: string,
  action: "pause" | "resume" | "skip-next" | "cancel"
): Promise<{ ok: boolean; error?: string }> {
  const headersIn = await getAuthHeaders()
  if (!hasAuth(headersIn)) {
    return { ok: false, error: "Not signed in" }
  }

  try {
    const encodedId = encodeURIComponent(subscriptionId)
    await sdk.client.fetch(`${SUBSCRIPTIONS_PATH}/${encodedId}/${action}`, {
      method: "POST",
      headers: headersIn,
      cache: "no-store",
    })
    await revalidateAfterSubscriptionMutation()
    return { ok: true }
  } catch (e) {
    if (e instanceof FetchError) {
      const msg = (e.message && e.message.trim()) || e.statusText || `Error ${e.status}`
      return { ok: false, error: msg }
    }
    const msg = e instanceof Error ? e.message : "Request failed"
    return { ok: false, error: msg || "Request failed" }
  }
}

export async function pauseSubscription(subscriptionId: string) {
  return postSubscriptionAction(subscriptionId, "pause")
}

export async function resumeSubscription(subscriptionId: string) {
  return postSubscriptionAction(subscriptionId, "resume")
}

export async function skipNextSubscriptionCycle(subscriptionId: string) {
  return postSubscriptionAction(subscriptionId, "skip-next")
}

export async function cancelSubscription(subscriptionId: string) {
  return postSubscriptionAction(subscriptionId, "cancel")
}
