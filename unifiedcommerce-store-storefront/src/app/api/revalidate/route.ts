import {
  STORE_CATEGORIES_CACHE_TAG,
  STORE_COLLECTIONS_CACHE_TAG,
  STORE_PRODUCTS_CACHE_TAG,
} from "@lib/data/cache-tags"
import { revalidatePath, revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * Revalidating this tag forces the next product request to refetch from the catalog API,
 * so price changes in Admin are reflected immediately.
 */
const PRODUCTS_CACHE_TAG = STORE_PRODUCTS_CACHE_TAG

/**
 * POST /api/revalidate
 *
 * On-demand revalidation for immediate price/catalog updates.
 * Call this after changing prices in Medusa Admin (or from a webhook) so the
 * storefront shows new data on the next request.
 *
 * Security: Requires REVALIDATE_SECRET to match (header or query).
 *
 * Example (after updating a product price in Medusa Admin):
 *   curl -X POST "https://your-store.com/api/revalidate" \
 *     -H "Authorization: Bearer YOUR_REVALIDATE_SECRET"
 *
 * Or with query (use only over HTTPS, or prefer header):
 *   POST /api/revalidate?secret=YOUR_REVALIDATE_SECRET
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.nextUrl.searchParams.get("secret")?.trim()

  const expected = process.env.REVALIDATE_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json(
      { revalidated: false, error: "Invalid or missing secret" },
      { status: 401 }
    )
  }

  try {
    revalidateTag(PRODUCTS_CACHE_TAG)
    revalidateTag(STORE_CATEGORIES_CACHE_TAG)
    revalidateTag(STORE_COLLECTIONS_CACHE_TAG)
    revalidatePath("/", "layout")
    return NextResponse.json({
      revalidated: true,
      tags: [
        PRODUCTS_CACHE_TAG,
        STORE_CATEGORIES_CACHE_TAG,
        STORE_COLLECTIONS_CACHE_TAG,
      ],
      message:
        "Product, category, collection, and layout caches invalidated. Next request will fetch fresh catalog data.",
    })
  } catch (e) {
    return NextResponse.json(
      { revalidated: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
