# Project Structure Guide

This document explains where to add **UI pages** and **services** in the TCS Unified Commerce Omnichannel storefront.

---

## High-level layout

```
src/
├── app/                    # Routes & pages (Next.js App Router)
├── lib/                    # Services, data, utilities, config
├── modules/                # Feature UI: templates + components
├── styles/                 # Global CSS
├── types/                  # Shared TypeScript types
└── middleware.ts           # Next.js middleware
```

---

## Where to add UI pages

**Location:** `src/app/`

All **routes and pages** live under the App Router. The app is scoped by **country code** (`[countryCode]`).

### Route structure

```
src/app/
├── layout.tsx                    # Root layout
├── not-found.tsx
└── [countryCode]/                # e.g. /us, /gb
    ├── (main)/                   # Main store (layout group)
    │   ├── layout.tsx
    │   ├── page.tsx               # Home: /
    │   ├── store/page.tsx         # Store: /us/store
    │   ├── cart/page.tsx          # Cart: /us/cart
    │   ├── products/[handle]/page.tsx   # Product: /us/products/t-shirt
    │   ├── categories/[...category]/page.tsx
    │   ├── collections/[handle]/page.tsx
    │   ├── account/               # Account (login, dashboard, orders, etc.)
    │   └── order/[id]/             # Order confirmation, transfer
    └── (checkout)/
        ├── layout.tsx
        └── checkout/page.tsx      # Checkout: /us/checkout
```

### Adding a new page

1. **New route**  
   Add a folder under the right segment and a `page.tsx`:

   - `src/app/[countryCode]/(main)/my-page/page.tsx`  
     → URL: `/{countryCode}/my-page` (e.g. `/us/my-page`).

2. **Dynamic segment**  
   Use a dynamic folder name, e.g. `[id]` or `[handle]`:

   - `src/app/[countryCode]/(main)/something/[id]/page.tsx`  
     → URL: `/{countryCode}/something/123`.

3. **What the page does**  
   - Fetches data via **`lib/data/*`** (or other services in `lib/`).
   - Renders a **template** from `modules/<feature>/templates/`.
   - Optionally uses **`modules/<feature>/components/`** for smaller UI pieces.

### Example: new “Deals” page

1. Create **`src/app/[countryCode]/(main)/deals/page.tsx`**:

```tsx
import { getRegion } from "@lib/data/regions"
import DealsTemplate from "@modules/deals/templates"

export default async function DealsPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const region = await getRegion(countryCode)
  if (!region) notFound()

  // Fetch deals (you’d add a lib/data/deals.ts service)
  // const deals = await getDeals(region.id)

  return <DealsTemplate region={region} />
}
```

2. Add the **template** in **`src/modules/deals/templates/index.tsx`** (and any components under `src/modules/deals/components/`).

---

## Where to add services

**Location:** `src/lib/`

**Services** = code that talks to APIs, backend, or shared logic. No UI here.

### Main places

| Folder        | Purpose | Examples |
|---------------|--------|----------|
| **`lib/data/`** | Data fetching & mutations (Medusa Store API, server actions) | `cart.ts`, `products.ts`, `orders.ts`, `regions.ts`, `customer.ts`, `payment.ts`, `fulfillment.ts` |
| **`lib/util/`** | Pure helpers, formatting, small logic | `money.ts`, `get-product-price.ts`, `store-api-error.ts`, `sort-products.ts` |
| **`lib/config.ts`** | App/config (e.g. Medusa SDK, env) | SDK client, base URL |
| **`lib/hooks/`** | Reusable React hooks | `use-toggle-state.ts`, `use-in-view.ts` |
| **`lib/i18n/`** | Translations | `translations.ts` |
| **`lib/context/`** | React context providers | `modal-context.tsx` |

### Adding a new service

1. **New API/data feature**  
   Add a file under **`lib/data/`**:

   - **`src/lib/data/deals.ts`**  
     - Export async functions that call `sdk.client.fetch()` or `sdk.store.*`, use cookies/headers from `lib/data/cookies.ts`, and return typed data.
   - Use **`"use server"`** if the functions are used as **Server Actions** (e.g. form actions, “add to cart” from the client).

2. **New pure helper**  
   Add under **`lib/util/`**:

   - **`src/lib/util/format-date.ts`**  
     - No `"use server"`, no UI; just (input) => output.

3. **New hook**  
   Add under **`lib/hooks/`**:

   - **`src/lib/hooks/use-debounce.ts`**  
     - Standard React hook; can be used from client components.

### Example: new “deals” data service

**`src/lib/data/deals.ts`**

```ts
"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"

export async function getDeals(regionId: string) {
  const headers = await getAuthHeaders()
  const next = await getCacheOptions("products")
  const { data } = await sdk.client.fetch<{ promotions: unknown[] }>(
    "/store/promotions",
    { method: "GET", query: { region_id: regionId }, headers, next }
  )
  return data?.promotions ?? []
}
```

Then use `getDeals(region.id)` in your **page** (`app/.../deals/page.tsx`) and pass the result into your **template** (`modules/deals/templates/`).

---

## How `modules/` fits in

**Location:** `src/modules/`

**Modules** group **UI by feature**: one folder per feature (products, cart, checkout, account, home, store, layout, etc.). They do **not** define routes; routes live in **`app/`**.

### Structure per feature

```
src/modules/<feature>/
├── components/          # Reusable UI for this feature
│   └── <name>/
│       └── index.tsx   (and optional client.tsx, subcomponents)
└── templates/          # Page-level layouts for this feature
    └── index.tsx       (or product-info/, checkout-form/, etc.)
```

- **Templates**  
  - Used by **pages** in `app/`.  
  - Compose **components** and optionally fetch a bit more data.  
  - Example: `ProductTemplate` in `modules/products/templates/index.tsx` is used by `app/.../products/[handle]/page.tsx`.

- **Components**  
  - Used inside templates or other components.  
  - Can be server or client (`"use client"`).  
  - Example: `ProductActions`, `ImageGallery` under `modules/products/components/`.

### Adding UI for a new feature

1. **New feature “deals”**
   - **`src/modules/deals/templates/index.tsx`**  
     - Main layout for the deals page (used by `app/.../deals/page.tsx`).
   - **`src/modules/deals/components/<component-name>/index.tsx`**  
     - Any reusable blocks (e.g. deal card, filters).

2. **New component in an existing feature**
   - Add under the right feature, e.g. **`src/modules/products/components/deal-badge/index.tsx`**.

---

## Data flow (summary)

1. **Route** (`app/[countryCode]/.../page.tsx`)  
   - Loads data via **`lib/data/*`** (and maybe `lib/util/*`).  
   - Renders a **template** from **`modules/<feature>/templates/`**.

2. **Template** (`modules/<feature>/templates/`)  
   - Receives props from the page.  
   - Composes **components** from **`modules/<feature>/components/`** (and sometimes `modules/common/`).

3. **Components** (`modules/<feature>/components/`)  
   - Receive data via props.  
   - May call **server actions** or **data functions** from **`lib/data/*`** (e.g. add to cart, update address).

4. **Services** (`lib/data/*`, `lib/util/*`)  
   - No UI.  
   - Called from **pages**, **templates**, or **components** (and from server actions in `lib/data/`).

---

## Quick reference

| I want to…              | Where to put it |
|-------------------------|------------------|
| Add a new URL/page      | `src/app/[countryCode]/(main)/<path>/page.tsx` (or under `(checkout)` if needed) |
| Add a new API call or server action | `src/lib/data/<name>.ts` |
| Add a pure helper       | `src/lib/util/<name>.ts` |
| Add a React hook        | `src/lib/hooks/<name>.tsx` |
| Add the main layout for a page | `src/modules/<feature>/templates/` |
| Add a reusable UI block | `src/modules/<feature>/components/<name>/index.tsx` |
| Add shared UI (buttons, modals, links) | `src/modules/common/components/` |
| Add global styles       | `src/styles/globals.css` |
| Add shared types        | `src/types/` |

Use this together with the existing `app/`, `lib/`, and `modules/` structure to add new UI pages and services in a consistent way.
