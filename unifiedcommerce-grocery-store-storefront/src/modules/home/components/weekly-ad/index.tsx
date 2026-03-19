"use client"

import { ArrowRight } from "@medusajs/icons"
import { Button, Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  MOCK_WEEKLY_AD,
  formatAdDateRange,
  type WeeklyAd as WeeklyAdType,
} from "./weekly-ad-data"

/** Whole Foods Market Sales Flyer style: https://www.wholefoodsmarket.com/sales-flyer */
const WFM_GREEN = "#006F46"

type WeeklyAdProps = {
  countryCode: string
  /** When provided, uses Contentful weekly ad data; otherwise falls back to mock data */
  ad?: WeeklyAdType | null
}

export default function WeeklyAd({ countryCode, ad: adProp }: WeeklyAdProps) {
  const ad = adProp ?? MOCK_WEEKLY_AD
  const dateRange = formatAdDateRange(ad.startDate, ad.endDate)

  return (
    <section
      className="content-container py-4 md:py-6 bg-[#f7f7f5]"
      aria-labelledby="weekly-ad-heading"
    >
      <div className="flex flex-col small:flex-row small:items-center small:justify-between gap-3">
        <div>
          <Heading
            id="weekly-ad-heading"
            level="h2"
            className="text-xl md:text-2xl font-semibold"
            style={{ color: WFM_GREEN }}
          >
            Weekly Sales
          </Heading>
          <Text className="mt-0.5 text-[#4a4a4a] txt-small">
            {dateRange}
          </Text>
          {ad.description && (
            <Text className="mt-1 text-[#6b6b6b] txt-small max-w-xl line-clamp-1">
              {ad.description}
            </Text>
          )}
        </div>
        <LocalizedClientLink href="/weekly-ad">
          <Button
            variant="secondary"
            size="small"
            className="shrink-0 gap-1.5 border-[#e5e5e0] text-[#2d2d2d] hover:bg-white hover:border-[#006F46]/40"
            style={{ backgroundColor: "white" }}
          >
            Shop All Deals
            <ArrowRight className="w-3.5 h-3.5" style={{ color: WFM_GREEN }} />
          </Button>
        </LocalizedClientLink>
      </div>

      {/* Cover card — Whole Foods style: clean, green accent */}
      <LocalizedClientLink href="/weekly-ad" className="block mt-4">
        <div
          className="relative w-full rounded-lg overflow-hidden border border-[#e5e5e0] bg-white hover:border-[#006F46]/30 hover:shadow-sm transition-all"
          style={{ minHeight: 140 }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-4 text-white"
            style={{ backgroundColor: WFM_GREEN }}
          >
            <span className="text-xs font-medium uppercase tracking-wider opacity-90">
              This Week&apos;s Savings
            </span>
            <span className="text-xl md:text-2xl font-bold mt-1">
              {ad.title}
            </span>
            <span className="text-sm mt-0.5 opacity-95">{dateRange}</span>
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
              View all deals
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </LocalizedClientLink>

      {/* Featured deals — WFM-style cards */}
      <div className="mt-4">
        <h3
          className="text-base font-semibold text-[#2d2d2d] mb-2"
          style={{ borderBottom: `2px solid ${WFM_GREEN}`, display: "inline-block", paddingBottom: 4 }}
        >
          Discover Our Latest & Greatest
        </h3>
        <ul className="grid grid-cols-1 small:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
          {ad.featuredDeals.slice(0, 3).map((deal) => (
            <li key={deal.id}>
              <div className="flex flex-col p-3 rounded-lg bg-white border border-[#e5e5e0] hover:border-[#006F46]/30 hover:shadow-sm transition-all h-full">
                <span className="txt-small text-[#6b6b6b]">{deal.category}</span>
                <span className="txt-compact-small-plus text-[#2d2d2d] font-medium mt-0.5">{deal.title}</span>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-base font-bold" style={{ color: WFM_GREEN }}>{deal.price}</span>
                  {deal.wasPrice && (
                    <span className="txt-small text-[#6b6b6b] line-through">{deal.wasPrice}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-center">
          <LocalizedClientLink href="/weekly-ad">
            <span
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-full"
              style={{ backgroundColor: WFM_GREEN }}
            >
              See all weekly sales
            </span>
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
