import { revalidatePath, revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cache tag used for raw product list (see src/lib/data/products.ts).
 * Revalidating this tag forces the next product request to refetch from Medusa,
 * so price changes in Admin are reflected immediately.
 */
const PRODUCTS_CACHE_TAG = "store-products-raw"

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
    revalidatePath("/", "layout")
    return NextResponse.json({
      revalidated: true,
      tag: PRODUCTS_CACHE_TAG,
      message: "Product and layout caches invalidated. Next request will fetch fresh prices.",
    })
  } catch (e) {
    return NextResponse.json(
      { revalidated: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
