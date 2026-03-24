import { Metadata } from "next"

import {
  formatAdDateRange,
  type WeeklyAdDeal,
} from "@modules/home/components/weekly-ad/weekly-ad-data"
import { getWeeklyAd } from "@lib/data/contentful-weekly-ad"
import WeeklyAdPageClient from "@modules/weekly-ad/templates"

export const metadata: Metadata = {
  title: "Weekly Sales",
  description: "Discover this week's deals and savings. Shop all deals at TCS Unified Commerce.",
}

type Params = {
  params: Promise<{ countryCode: string }>
}

export default async function WeeklyAdPage(props: Params) {
  const params = await props.params
  
  // Fetch weekly ad from Contentful (falls back to mock data if unavailable)
  // Prices are fetched from Medusa product database, not Contentful
  const ad = await getWeeklyAd(params.countryCode, "en")
  const dateRange = formatAdDateRange(ad.startDate, ad.endDate)

  // Group deals by category for Smart & Final style browsing
  const dealsByCategory = ad.featuredDeals.reduce<Record<string, WeeklyAdDeal[]>>(
    (acc, deal) => {
      const cat = deal.category || "Other"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(deal)
      return acc
    },
    {}
  )

  return (
    <WeeklyAdPageClient
      countryCode={params.countryCode}
      title={ad.title}
      dateRange={dateRange}
      description={ad.description}
      dealsByCategory={dealsByCategory}
    />
  )
}
