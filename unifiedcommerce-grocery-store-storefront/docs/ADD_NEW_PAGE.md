# How to Add a New Page (e.g. Weekly Ad)

This guide walks through adding a new page like **Weekly Ad** to the storefront. The same steps apply for any new route (Deals, About, FAQ, etc.).

---

## Overview

| Step | What you add | Where |
|------|--------------|--------|
| 1 | **Route (page)** | `src/app/[countryCode]/(main)/weeklyad/page.tsx` |
| 2 | **Template (layout)** | `src/modules/weeklyad/templates/index.tsx` |
| 3 | **Components** (optional) | `src/modules/weeklyad/components/` |
| 4 | **Data service** (optional) | `src/lib/data/weeklyad.ts` |
| 5 | **Link in nav/footer** (optional) | `src/modules/layout/templates/nav/` or `footer/` |

---

## Step 1: Create the route (page)

The **page** defines the URL and fetches data. It lives under the App Router.

**File:** `src/app/[countryCode]/(main)/weeklyad/page.tsx`

- **URL:** `/{countryCode}/weeklyad` (e.g. `/us/weeklyad`, `/gb/weeklyad`)
- **Layout:** Uses the main store layout (nav + footer) because it’s under `(main)/`.

**Minimal example:**

```tsx
import { Metadata } from "next"
import { getRegion } from "@lib/data/regions"
import { notFound } from "next/navigation"
import WeeklyAdTemplate from "@modules/weeklyad/templates"

export const metadata: Metadata = {
  title: "Weekly Ad",
  description: "This week's deals and specials.",
}

type Props = {
  params: Promise<{ countryCode: string }>
}

export default async function WeeklyAdPage({ params }: Props) {
  const { countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) {
    notFound()
  }

  return <WeeklyAdTemplate countryCode={countryCode} region={region} />
}
```

**With search params (e.g. `?week=2`):**

```tsx
type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ week?: string }>
}

export default async function WeeklyAdPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const { week } = await searchParams
  const region = await getRegion(countryCode)
  if (!region) notFound()

  return (
    <WeeklyAdTemplate
      countryCode={countryCode}
      region={region}
      week={week}
    />
  )
}
```

---

## Step 2: Create the template

The **template** is the main UI for the page. It goes in a **module** for that feature.

**File:** `src/modules/weeklyad/templates/index.tsx`

- Import shared UI from `@modules/common` and layout from `@modules/layout` if needed.
- The page (Step 1) passes props (e.g. `countryCode`, `region`, `week`).

**Minimal example:**

```tsx
import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"

type WeeklyAdTemplateProps = {
  countryCode: string
  region: HttpTypes.StoreRegion
  week?: string
}

export default function WeeklyAdTemplate({
  countryCode,
  region,
  week,
}: WeeklyAdTemplateProps) {
  return (
    <div className="content-container py-8">
      <Heading level="h1" className="mb-4">
        Weekly Ad
      </Heading>
      <Text className="text-ui-fg-subtle">
        This week&apos;s deals for {region.name}.
        {week && ` (Week ${week})`}
      </Text>
      {/* Add your weekly ad content / components here */}
    </div>
  )
}
```

**If the template needs client interactivity**, use a client component inside it:

```tsx
// templates/index.tsx
import WeeklyAdContent from "@modules/weeklyad/components/weekly-ad-content"

export default function WeeklyAdTemplate({ countryCode, region, week }: Props) {
  return (
    <div className="content-container py-8">
      <WeeklyAdContent countryCode={countryCode} week={week} />
    </div>
  )
}
```

```tsx
// components/weekly-ad-content/index.tsx
"use client"

import { useState } from "react"

export default function WeeklyAdContent({
  countryCode,
  week,
}: {
  countryCode: string
  week?: string
}) {
  const [selectedWeek, setSelectedWeek] = useState(week ?? "1")
  // ...
  return <div>{/* interactive weekly ad UI */}</div>
}
```

---

## Step 3: Add components (optional)

For reusable pieces of the Weekly Ad page, add them under the same module.

**Folder:** `src/modules/weeklyad/components/`

**Examples:**

- `src/modules/weeklyad/components/weekly-ad-hero/index.tsx` – hero section
- `src/modules/weeklyad/components/weekly-ad-grid/index.tsx` – grid of deals
- `src/modules/weeklyad/components/weekly-ad-item/index.tsx` – single deal card

Use these from the template:

```tsx
import WeeklyAdHero from "@modules/weeklyad/components/weekly-ad-hero"
import WeeklyAdGrid from "@modules/weeklyad/components/weekly-ad-grid"

export default function WeeklyAdTemplate(props: WeeklyAdTemplateProps) {
  return (
    <div className="content-container py-8">
      <WeeklyAdHero />
      <WeeklyAdGrid {...props} />
    </div>
  )
}
```

---

## Step 4: Add a data service (optional)

If the page needs data from an API or Medusa, add a **data** module under `lib/data/`.

**File:** `src/lib/data/weeklyad.ts`

```ts
"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

export async function getWeeklyAdDeals(regionId: string, week?: string) {
  const headers = await getAuthHeaders()
  const next = await getCacheOptions("products")

  // Example: fetch promotions or a custom API
  const response = await sdk.client.fetch<{ promotions: unknown[] }>(
    "/store/promotions",
    {
      method: "GET",
      query: { region_id: regionId },
      headers,
      next,
    }
  )

  return response.promotions ?? []
}
```

Use it in the **page** and pass the result to the template:

```tsx
// app/[countryCode]/(main)/weeklyad/page.tsx
import { getWeeklyAdDeals } from "@lib/data/weeklyad"

export default async function WeeklyAdPage({ params }: Props) {
  const { countryCode } = await params
  const region = await getRegion(countryCode)
  if (!region) notFound()

  const deals = await getWeeklyAdDeals(region.id)

  return (
    <WeeklyAdTemplate
      countryCode={countryCode}
      region={region}
      deals={deals}
    />
  )
}
```

---

## Step 5: Link from nav or footer (optional)

So users can open the new page from the header or footer:

**Nav:** edit `src/modules/layout/templates/nav/index.tsx` and add a link next to existing ones (e.g. Store, Cart):

```tsx
<LocalizedClientLink href="/weeklyad">Weekly Ad</LocalizedClientLink>
```

**Footer:** edit `src/modules/layout/templates/footer/index.tsx` and add a link in the appropriate column:

```tsx
<LocalizedClientLink href="/weeklyad">Weekly Ad</LocalizedClientLink>
```

Use `LocalizedClientLink` so the link keeps the current `countryCode` (e.g. `/us/weeklyad`).

---

## Checklist summary

- [ ] **Route:** `src/app/[countryCode]/(main)/weeklyad/page.tsx` (metadata, params, optional searchParams, call template).
- [ ] **Template:** `src/modules/weeklyad/templates/index.tsx` (main layout and content).
- [ ] **Components:** (optional) `src/modules/weeklyad/components/<name>/index.tsx`.
- [ ] **Data:** (optional) `src/lib/data/weeklyad.ts` and use in the page.
- [ ] **Nav/Footer:** (optional) Add “Weekly Ad” link in nav or footer.

---

## File path quick reference

| Purpose | Path |
|--------|------|
| New page URL | `src/app/[countryCode]/(main)/<slug>/page.tsx` |
| Page layout/content | `src/modules/<feature>/templates/index.tsx` |
| Page-specific components | `src/modules/<feature>/components/<name>/index.tsx` |
| API / server data | `src/lib/data/<name>.ts` |
| Nav link | `src/modules/layout/templates/nav/index.tsx` |
| Footer link | `src/modules/layout/templates/footer/index.tsx` |

---

## See also

- **Project structure:** `PROJECT_STRUCTURE.md` (where UI vs services live).
- **Existing examples:**  
  - Simple page: `src/app/[countryCode]/(main)/store/page.tsx` + `src/modules/store/templates/index.tsx`  
  - Dynamic page: `src/app/[countryCode]/(main)/products/[handle]/page.tsx`  
  - Layout: `src/app/[countryCode]/(main)/layout.tsx`
