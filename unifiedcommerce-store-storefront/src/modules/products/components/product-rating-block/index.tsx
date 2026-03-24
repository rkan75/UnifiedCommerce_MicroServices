"use client"

import { HttpTypes } from "@medusajs/types"

type Meta = Record<string, unknown> | null | undefined

function num(meta: Meta, key: string): number | null {
  const v = meta?.[key]
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

type ProductRatingBlockProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Renders when product.metadata includes rating (0–5) and/or review_count.
 * Optional: reviews_url, answered_questions_label, write_review_label.
 */
export default function ProductRatingBlock({ product }: ProductRatingBlockProps) {
  const meta = product.metadata as Meta
  const rating = num(meta, "rating") ?? num(meta, "rating_avg")
  const reviewCount = num(meta, "review_count")
  const reviewsUrl =
    typeof meta?.reviews_url === "string" && meta.reviews_url.trim()
      ? meta.reviews_url.trim()
      : null

  if (rating == null && reviewCount == null) {
    return null
  }

  const rounded = rating != null ? Math.min(5, Math.max(0, rating)) : null
  const fullStars = rounded != null ? Math.floor(rounded + 0.25) : 0
  const displayFull = Math.min(5, fullStars)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {rounded != null ? (
        <div
          className="flex items-center gap-1"
          aria-label={`${rounded} out of 5 stars`}
        >
          <span className="tracking-tight text-amber-500" aria-hidden>
            {"★".repeat(displayFull)}
            {"☆".repeat(5 - displayFull)}
          </span>
          {rating != null ? (
            <span className="font-medium text-ui-fg-base">{rating.toFixed(1)}</span>
          ) : null}
        </div>
      ) : null}
      {reviewCount != null ? (
        reviewsUrl ? (
          <a
            href={reviewsUrl}
            className="text-ui-fg-interactive hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            ({reviewCount} reviews)
          </a>
        ) : (
          <span className="text-ui-fg-subtle">({reviewCount} reviews)</span>
        )
      ) : null}
      {typeof meta?.answered_questions_label === "string" &&
      meta.answered_questions_label.trim() ? (
        <span className="text-ui-fg-interactive">{meta.answered_questions_label}</span>
      ) : null}
      {typeof meta?.write_review_label === "string" && meta.write_review_label.trim() ? (
        reviewsUrl ? (
          <a href={reviewsUrl} className="text-ui-fg-interactive hover:underline">
            {meta.write_review_label}
          </a>
        ) : (
          <span className="text-ui-fg-subtle">{meta.write_review_label}</span>
        )
      ) : reviewsUrl && reviewCount != null ? (
        <a href={reviewsUrl} className="text-ui-fg-interactive hover:underline">
          Write a review
        </a>
      ) : null}
    </div>
  )
}
