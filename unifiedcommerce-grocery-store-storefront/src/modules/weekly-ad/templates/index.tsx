"use client"

import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { WeeklyAdDeal } from "@modules/home/components/weekly-ad/weekly-ad-data"

/** Whole Foods Market Sales Flyer style: https://www.wholefoodsmarket.com/sales-flyer */
const WFM_GREEN = "#006F46"
const WFM_GREEN_DARK = "#005a38"

function DealCardContent({ deal }: { deal: WeeklyAdDeal }) {
  return (
    <>
      <span className="text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">
        {deal.category}
      </span>
      <span className="text-base font-semibold text-[#2d2d2d] mt-1 line-clamp-2">
        {deal.title}
      </span>
      {deal.description && (
        <Text className="mt-1 text-sm text-[#6b6b6b] line-clamp-2">
          {deal.description}
        </Text>
      )}
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span
          className="text-lg font-bold"
          style={{ color: WFM_GREEN }}
        >
          {deal.price}
        </span>
        {deal.wasPrice && (
          <span className="text-sm text-[#6b6b6b] line-through">
            {deal.wasPrice}
          </span>
        )}
      </div>
    </>
  )
}

type WeeklyAdPageClientProps = {
  countryCode: string
  title: string
  dateRange: string
  description?: string | null
  dealsByCategory: Record<string, WeeklyAdDeal[]>
}

export default function WeeklyAdPageClient({
  countryCode,
  title,
  dateRange,
  description,
  dealsByCategory,
}: WeeklyAdPageClientProps) {
  const categories = Object.keys(dealsByCategory).sort()

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Hero — Whole Foods style: clean header, "Shop All Deals" CTA */}
      <header className="bg-white border-b border-[#e5e5e0]">
        <div className="content-container py-8 md:py-10">
          <h1
            className="text-3xl md:text-4xl font-semibold tracking-tight"
            style={{ color: WFM_GREEN }}
          >
            Weekly Sales
          </h1>
          <p className="mt-2 text-base text-[#4a4a4a]">
            {dateRange}
          </p>
          {description && (
            <p className="mt-1 text-sm text-[#6b6b6b] max-w-2xl">
              {description}
            </p>
          )}
          <LocalizedClientLink href="/store" className="inline-block mt-6">
            <span
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white rounded-full transition-opacity hover:opacity-95"
              style={{ backgroundColor: WFM_GREEN }}
            >
              Shop All Deals
            </span>
          </LocalizedClientLink>
        </div>
      </header>

      {/* Main content — "Discover Our Latest & Greatest" style */}
      <main className="content-container py-8 md:py-12">
        <section className="mb-10" aria-labelledby="discover-heading">
          <h2
            id="discover-heading"
            className="text-2xl md:text-3xl font-semibold tracking-tight"
            style={{ color: WFM_GREEN }}
          >
            Discover Our Latest & Greatest
          </h2>
          <p className="mt-2 text-base text-[#4a4a4a] max-w-2xl">
            Check out what&apos;s hot right now, including limited-time-only savings, new finds and seasonal favourites.
          </p>
        </section>

        {/* Deals by category — clean grid, WFM-style cards */}
        <div className="flex flex-col gap-10">
          {categories.map((category) => (
            <section key={category} aria-labelledby={`category-${category}`}>
              <h3
                id={`category-${category}`}
                className="text-lg font-semibold text-[#2d2d2d] mb-4 pb-2"
                style={{ borderBottom: `2px solid ${WFM_GREEN}` }}
              >
                {category}
              </h3>
              <ul className="grid grid-cols-1 small:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {dealsByCategory[category].map((deal) => (
                  <li key={deal.id}>
                    {deal.productHandle ? (
                      <LocalizedClientLink
                        href={`/products/${deal.productHandle}`}
                        className="flex flex-col p-4 rounded-lg bg-white border border-[#e5e5e0] hover:border-[#006F46]/30 hover:shadow-sm transition-all h-full block"
                      >
                        <DealCardContent deal={deal} />
                      </LocalizedClientLink>
                    ) : (
                      <div className="flex flex-col p-4 rounded-lg bg-white border border-[#e5e5e0] hover:border-[#006F46]/30 hover:shadow-sm transition-all h-full">
                        <DealCardContent deal={deal} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer CTA — Whole Foods style */}
        <div className="mt-12 pt-8 border-t border-[#e5e5e0] text-center">
          <LocalizedClientLink href="/store">
            <span
              className="text-base font-semibold hover:underline"
              style={{ color: WFM_GREEN }}
            >
              Shop all products →
            </span>
          </LocalizedClientLink>
        </div>
      </main>
    </div>
  )
}
