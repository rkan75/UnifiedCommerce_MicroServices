"use server"

import {
  getCartServiceBaseUrl,
  getMedusaPublishableKeyHeaders,
} from "@lib/config/products-service"
import { fetchWithConnectionContext } from "@lib/util/fetch-with-connection-context"
import { getAuthHeaders } from "./cookies"

export async function cartServiceUrl(
  path: string,
  query?: Record<string, string | undefined>
): Promise<string> {
  const base = getCartServiceBaseUrl().replace(/\/$/, "")
  const p = path.startsWith("/") ? path : `/${path}`
  const u = new URL(base + p)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, v)
    }
  }
  return u.toString()
}

export async function cartServiceHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    ...getMedusaPublishableKeyHeaders(),
  }
  const auth = await getAuthHeaders()
  if ("authorization" in auth && auth.authorization) {
    h.authorization = auth.authorization
  }
  return h
}

type CartFetchInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
  query?: Record<string, string | undefined>
  /** Next.js extended fetch cache tags / revalidate */
  next?: { tags?: string[]; revalidate?: number }
}

export async function cartServiceFetch(
  path: string,
  init: CartFetchInit = {}
): Promise<Response> {
  const { query, headers: extraHeaders, next, ...rest } = init
  const url = await cartServiceUrl(path, query)
  const baseHeaders = await cartServiceHeaders()
  const merged: Record<string, string> = {
    ...baseHeaders,
    ...(extraHeaders ?? {}),
  }
  if (
    rest.body != null &&
    typeof rest.body === "string" &&
    !merged["Content-Type"]
  ) {
    merged["Content-Type"] = "application/json"
  }
  return fetchWithConnectionContext(url, {
    ...rest,
    ...(next && Object.keys(next).length > 0 ? { next } : {}),
    headers: merged,
  })
}

export async function throwIfCartServiceError(
  res: Response,
  context: string
): Promise<void> {
  if (res.ok) return
  const t = await res.text().catch(() => "")
  let msg = `${context}: ${res.status}`
  try {
    const j = JSON.parse(t) as { message?: string }
    if (j.message) msg = j.message
    else if (t) msg = `${msg} ${t.slice(0, 200)}`
  } catch {
    if (t) msg = `${msg} ${t.slice(0, 200)}`
  }
  throw new Error(msg)
}
