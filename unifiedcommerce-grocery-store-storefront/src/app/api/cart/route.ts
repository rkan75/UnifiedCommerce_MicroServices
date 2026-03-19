import { retrieveCart } from "@lib/data/cart"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/cart - Returns the current cart for client-side updates.
 * Used to refresh cart without full page reload (e.g. when adding from product list).
 */
export async function GET() {
  try {
    const cart = await retrieveCart()
    return NextResponse.json(cart)
  } catch {
    return NextResponse.json(null)
  }
}
