"use client"

import {
  addToWishlistByVariant,
  removeFromWishlistByVariant,
} from "@lib/data/wishlist"
import { useWishlist } from "@modules/common/components/wishlist-provider"
import { Button, toast } from "@medusajs/ui"
import { Heart } from "@medusajs/icons"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { clx } from "@medusajs/ui"

/** Filled heart for "in wishlist" state (uses currentColor → brand red). */
function HeartFilled({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  )
}

type AddToWishlistButtonProps = {
  productId: string
  variantId: string | undefined
  quantity?: number
  /** Show as icon-only button (e.g. on product cards) */
  showAsIcon?: boolean
  className?: string
  "data-testid"?: string
}

export default function AddToWishlistButton({
  productId,
  variantId,
  quantity = 1,
  showAsIcon = false,
  className,
  "data-testid": dataTestId,
}: AddToWishlistButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const wishlist = useWishlist()
  const inWishlist = variantId ? wishlist?.isInWishlist(variantId) ?? false : false

  if (!variantId) return null

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isLoading) return
    setIsLoading(true)
    try {
      if (inWishlist) {
        const result = await removeFromWishlistByVariant(variantId, productId)
        if (result.success) {
          wishlist?.removeVariantId(variantId)
          toast.success("Removed from wishlist")
          router.refresh()
        } else {
          toast.error(result.error || "Could not remove from wishlist")
        }
      } else {
        const result = await addToWishlistByVariant(variantId, productId, quantity)
        if (result.success) {
          wishlist?.addVariantId(variantId)
          toast.success("Added to wishlist")
          router.refresh()
        } else {
          if (result.error?.toLowerCase().includes("not logged in")) {
            toast.error("Sign in to add items to your wishlist")
          } else {
            toast.error(result.error || "Could not add to wishlist")
          }
        }
      }
    } catch {
      toast.error(
        inWishlist ? "Could not remove from wishlist" : "Could not add to wishlist"
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (showAsIcon) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={clx(
          "flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-ui-border-base shadow-sm transition-colors",
          inWishlist
            ? "border-header-red/35 bg-red-50/95 text-header-red hover:bg-red-50"
            : "text-ui-fg-subtle hover:text-ui-fg-base",
          className,
          inWishlist && "!opacity-100"
        )}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        data-testid={dataTestId ?? "add-to-wishlist-button"}
      >
        {inWishlist ? (
          <HeartFilled className="h-4 w-4 text-header-red" />
        ) : (
          <Heart className="h-4 w-4" />
        )}
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      onClick={handleClick}
      disabled={isLoading}
      isLoading={isLoading}
      className={clx(
        inWishlist &&
          "border-header-red/40 bg-red-50 text-header-red hover:bg-red-100",
        className
      )}
      data-testid={dataTestId ?? "add-to-wishlist-button"}
    >
      {inWishlist ? (
        <HeartFilled className="mr-1.5 h-4 w-4 text-header-red" />
      ) : (
        <Heart className="mr-1.5 h-4 w-4" />
      )}
      {inWishlist ? "In wishlist" : "Add to wishlist"}
    </Button>
  )
}
