import { retrieveCartLive } from "@lib/data/cart"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/cart - Returns the current cart for client-side updates.
 * Uses uncached `retrieveCartLive` so counts stay in sync after add-to-cart (see cart.ts).
 */
export async function GET() {
  try {
    const cart = await retrieveCartLive()
    return NextResponse.json(cart)
  } catch {
    return NextResponse.json(null)
  }
}
