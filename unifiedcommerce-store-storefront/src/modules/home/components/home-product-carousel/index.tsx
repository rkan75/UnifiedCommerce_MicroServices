"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HttpTypes } from "@medusajs/types"

import CarouselProductCard, {
  type CarouselCardLabels,
} from "./carousel-product-card"

type HomeProductCarouselProps = {
  products: HttpTypes.StoreProduct[]
  title: string
  /** i18n strings for product cards (badge, category, CTA) */
  labels: CarouselCardLabels & { adding: string }
}

function getScrollStepPx(scroller: HTMLElement): number {
  const cards = scroller.querySelectorAll<HTMLElement>("[data-carousel-card]")
  if (cards.length < 2) {
    return Math.max(1, Math.round(scroller.clientWidth * 0.92))
  }
  const a = cards[0].getBoundingClientRect()
  const b = cards[1].getBoundingClientRect()
  return Math.max(1, Math.round(b.left - a.left))
}

export default function HomeProductCarousel({
  products,
  title,
  labels,
}: HomeProductCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  const updateScrollButtons = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    const epsilon = 4
    setCanScrollPrev(scrollLeft > epsilon)
    setCanScrollNext(scrollLeft < maxScroll - epsilon)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollButtons()
    el.addEventListener("scroll", updateScrollButtons, { passive: true })
    const ro = new ResizeObserver(() => updateScrollButtons())
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollButtons)
      ro.disconnect()
    }
  }, [products, updateScrollButtons])

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const delta = getScrollStepPx(el)
    el.scrollBy({ left: dir * delta, behavior: "smooth" })
    window.requestAnimationFrame(() => {
      window.setTimeout(updateScrollButtons, 350)
    })
  }, [updateScrollButtons])

  if (!products.length) return null

  const cardLabels: CarouselCardLabels = {
    addToCart: labels.addToCart,
    moreStock: labels.moreStock,
    inStock: labels.inStock,
    outOfStock: labels.outOfStock,
    categoryFallback: labels.categoryFallback,
  }

  return (
    <section
      className="border-b border-gray-100 bg-white py-8 small:py-10"
      aria-labelledby="home-product-carousel-heading"
    >
      <div className="content-container">
        <div className="mb-6">
          <h2
            id="home-product-carousel-heading"
            className="text-xl font-bold uppercase tracking-wide text-[#111] small:text-2xl"
          >
            {title}
          </h2>
        </div>

        {/* Nav controls sit on the carousel strip only (not the title row) */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-start bg-gradient-to-r from-white via-white/90 to-transparent pl-0 sm:w-14">
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              disabled={!canScrollPrev}
              aria-label="Previous products"
              className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-grey-20 bg-white text-grey-80 shadow-md transition hover:border-header-red hover:text-header-red disabled:pointer-events-none disabled:opacity-30 sm:h-11 sm:w-11"
            >
              <ChevronIcon dir="left" />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent pr-0 sm:w-14">
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              disabled={!canScrollNext}
              aria-label="Next products"
              className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-grey-20 bg-white text-grey-80 shadow-md transition hover:border-header-red hover:text-header-red disabled:pointer-events-none disabled:opacity-30 sm:h-11 sm:w-11"
            >
              <ChevronIcon dir="right" />
            </button>
          </div>

          <div
            ref={scrollerRef}
            className="flex gap-6 overflow-x-auto scroll-smooth py-2 pl-1 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {products.map((product) => (
              <CarouselProductCard
                key={product.id}
                product={product}
                labels={cardLabels}
                addingLabel={labels.adding}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  )
}
