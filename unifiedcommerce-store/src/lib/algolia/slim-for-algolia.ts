/**
 * Algolia record size limit is 10KB per object (JSON serialized).
 * Trim heavy fields so bulk index / upload succeeds.
 */
const encoder = new TextEncoder()

/** Target max encoded JSON size (bytes) — stay under Algolia's 10_000. */
export const ALGOLIA_RECORD_TARGET_BYTES = 9_200

export function utf8ByteLength(s: string): number {
  return encoder.encode(s).length
}

/** Truncate string so UTF-8 byte length ≤ maxBytes. */
export function truncateUtf8Bytes(s: string, maxBytes: number): string {
  if (utf8ByteLength(s) <= maxBytes) return s
  let low = 0
  let high = s.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (utf8ByteLength(s.slice(0, mid)) <= maxBytes) low = mid
    else high = mid - 1
  }
  return s.slice(0, low) + "…"
}

function jsonByteSize(obj: unknown): number {
  return encoder.encode(JSON.stringify(obj)).length
}

/**
 * Returns a copy safe to send to Algolia (under ~10KB when stringified).
 */
export function slimAlgoliaRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record }

  if (typeof out.title === "string") {
    out.title = truncateUtf8Bytes(out.title, 512)
  }
  if (typeof out.description === "string") {
    out.description = truncateUtf8Bytes(out.description, 4_000)
  }
  if (typeof out.handle === "string") {
    out.handle = truncateUtf8Bytes(out.handle, 256)
  }
  if (typeof out.thumbnail === "string") {
    out.thumbnail = truncateUtf8Bytes(out.thumbnail, 2_048)
  }

  if (Array.isArray(out.images)) {
    out.images = out.images
      .slice(0, 12)
      .map((u) => (typeof u === "string" ? truncateUtf8Bytes(u, 1_024) : u))
  }

  if (Array.isArray(out.variants)) {
    out.variants = out.variants.map((v: unknown) => {
      if (!v || typeof v !== "object") return v
      const vv = v as Record<string, unknown>
      const title =
        typeof vv.title === "string"
          ? truncateUtf8Bytes(vv.title, 160)
          : vv.title
      const sku =
        typeof vv.sku === "string" ? truncateUtf8Bytes(vv.sku, 128) : vv.sku
      return { ...vv, title, sku }
    })
  }

  if (typeof out.variant_sku === "string") {
    out.variant_sku = truncateUtf8Bytes(out.variant_sku, 1_500)
  }
  if (typeof out.options === "string") {
    out.options = truncateUtf8Bytes(out.options, 500)
  }
  if (typeof out.collection_title === "string") {
    out.collection_title = truncateUtf8Bytes(out.collection_title, 256)
  }
  if (typeof out.collection_handle === "string") {
    out.collection_handle = truncateUtf8Bytes(out.collection_handle, 256)
  }

  if (out.metadata != null) {
    const metaStr = JSON.stringify(out.metadata)
    if (metaStr.length > 1_200) {
      out.metadata = { _note: "metadata omitted for Algolia size limit" }
    }
  }

  // Shrink until under target
  let guard = 0
  while (jsonByteSize(out) > ALGOLIA_RECORD_TARGET_BYTES && guard < 24) {
    guard += 1
    if (typeof out.description === "string") {
      const raw = out.description.replace(/…$/, "")
      if (utf8ByteLength(raw) > 60) {
        const target = Math.max(60, Math.floor(utf8ByteLength(raw) * 0.65))
        out.description = truncateUtf8Bytes(raw, target)
        continue
      }
    }
    if (Array.isArray(out.images) && out.images.length > 3) {
      out.images = out.images.slice(0, Math.max(3, out.images.length - 2))
      continue
    }
    out.metadata = undefined
    if (Array.isArray(out.images) && out.images.length > 1) {
      out.images = out.images.slice(0, 1)
      continue
    }
    break
  }

  if (jsonByteSize(out) > 10_000) {
    out.description = truncateUtf8Bytes(
      typeof out.description === "string" ? out.description : "",
      500
    )
    out.images = []
    out.metadata = undefined
  }

  return out
}
