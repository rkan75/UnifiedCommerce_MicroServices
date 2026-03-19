/**
 * Weekly ad data. In production, replace with CMS or API.
 * Reference: Smart & Final style weekly circular (date range, cover, featured deals).
 */

export type WeeklyAdDeal = {
  id: string
  title: string
  description?: string
  price: string
  wasPrice?: string
  image?: string
  category: string
  validThrough?: string
  /** Product handle for linking to PDP (from Contentful) */
  productHandle?: string
}

export type WeeklyAd = {
  id: string
  title: string
  startDate: string // ISO date
  endDate: string
  coverImage?: string
  description?: string
  featuredDeals: WeeklyAdDeal[]
}

function getCurrentWeekDates(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToSunday = day === 0 ? 0 : day
  const start = new Date(now)
  start.setDate(now.getDate() - diffToSunday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

const { start: startDate, end: endDate } = getCurrentWeekDates()

export const MOCK_WEEKLY_AD: WeeklyAd = {
  id: "wa-1",
  title: "This Week's Deals",
  startDate,
  endDate,
  description: "Save on groceries this week. Valid in-store and online.",
  featuredDeals: [
    {
      id: "d1",
      title: "Organic Bananas",
      price: "$0.69",
      wasPrice: "$0.99",
      category: "Produce",
    },
    {
      id: "d2",
      title: "Fresh Whole Milk",
      price: "$2.99",
      wasPrice: "$3.49",
      category: "Dairy",
    },
    {
      id: "d3",
      title: "Farm Fresh Eggs",
      price: "$3.49",
      wasPrice: "$4.29",
      category: "Dairy",
    },
    {
      id: "d4",
      title: "Whole Chicken",
      price: "$1.29/lb",
      wasPrice: "$1.99/lb",
      category: "Meat",
    },
    {
      id: "d5",
      title: "Organic Broccoli",
      price: "$1.49",
      wasPrice: "$1.99",
      category: "Produce",
    },
    {
      id: "d6",
      title: "Greek Yogurt 32oz",
      price: "$4.99",
      wasPrice: "$5.99",
      category: "Dairy",
    },
  ],
}

export function formatAdDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`
}
