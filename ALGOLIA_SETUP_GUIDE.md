# Medusa Algolia Plugin - Complete Setup Guide

This guide walks you through installing and configuring the `medusa-plugin-algolia` plugin for advanced search functionality in your Medusa v2 storefront.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Get Algolia Credentials](#step-1-get-algolia-credentials)
3. [Step 2: Backend Installation](#step-2-backend-installation)
4. [Step 3: Backend Configuration](#step-3-backend-configuration)
5. [Step 4: Storefront Installation](#step-4-storefront-installation)
6. [Step 5: Storefront Configuration](#step-5-storefront-configuration)
7. [Step 6: Create Search Components](#step-6-create-search-components)
8. [Step 7: Test the Integration](#step-7-test-the-integration)
9. [How to Index Products in Algolia](#how-to-index-products-in-algolia)
10. [Step-by-step: Export product data to JSON and upload to Algolia](#step-by-step-export-product-data-to-json-and-upload-to-algolia)
11. [Troubleshooting](#troubleshooting)
12. [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

- ✅ Medusa backend v2.12.6+ installed and running
- ✅ Next.js storefront (demo-grocery-store-storefront)
- ✅ Algolia account (free tier available at https://www.algolia.com/)
- ✅ Node.js 20+
- ✅ npm or yarn package manager

---

## Step 1: Get Algolia Credentials

1. **Sign up/Login to Algolia**
   - Go to https://www.algolia.com/
   - Create a free account or sign in

2. **Get Your API Keys**
   - Navigate to **Settings** → **API Keys** in your Algolia dashboard
   - You'll need three values:
     - **Application ID** (`ALGOLIA_APP_ID`)
     - **Admin API Key** (`ALGOLIA_ADMIN_API_KEY`) - Keep this secret! Used for backend indexing
     - **Search-Only API Key** (`ALGOLIA_SEARCH_API_KEY`) - Safe for frontend, used in storefront

3. **Note Your Index Name**
   - The plugin will create an index called `products` by default
   - You can customize this if needed

---

## Step 2: Backend Installation

### 2.1 Install the Plugin

Navigate to your backend directory and install the plugin:

```bash
cd demo-grocery-store
npm install medusa-plugin-algolia --legacy-peer-deps
```

**Note:** We use `--legacy-peer-deps` because the plugin has peer dependency conflicts with Medusa v2. This is safe and won't affect functionality.

**Alternative:** If you prefer, you can add `legacy-peer-deps=true` to `.npmrc` file (already created) so you don't need the flag each time.

### 2.2 Verify Installation

Check that the package was added to `package.json`:

```bash
grep "medusa-plugin-algolia" package.json
```

You should see:
```json
"medusa-plugin-algolia": "^0.2.21"
```

---

## Step 3: Backend Configuration

### 3.1 Add Environment Variables

Add the following to your `demo-grocery-store/.env` file:

```env
# Algolia Configuration
ALGOLIA_APP_ID=your_app_id_here
ALGOLIA_ADMIN_API_KEY=your_admin_api_key_here
```

**Important:** 
- Replace `your_app_id_here` and `your_admin_api_key_here` with your actual values from Step 1
- Never commit these values to version control
- The Admin API Key has write access - keep it secret!

### 3.2 Plugin Configuration

The plugin is already configured in `medusa-config.ts`. Here's what it does:

**Searchable Attributes:**
- `title` - Product title
- `description` - Product description
- `tags` - Product tags
- `collection_title` - Collection name
- `variant_sku` - Product variant SKUs
- `options` - Product options

**Retrievable Attributes:**
- Product ID, title, description, handle
- Thumbnail and images
- Variants information
- Collection details
- Metadata

**Faceting:**
- Collections (for filtering by collection)
- Options (for filtering by product options)

### 3.3 Start Backend and Index Products

```bash
npm run dev
```

When you start the backend:
- The plugin will automatically create the Algolia index
- Products will be indexed automatically when:
  - A product is created
  - A product is updated
  - A product is deleted

**Check indexing status:**
- Look for console logs: `✅ Algolia search plugin configured`
- Check Algolia Dashboard → **Indices** → **products** to see indexed products

---

## Step 4: Storefront Installation

### 4.1 Install Algolia SDK Packages

Navigate to your storefront directory:

```bash
cd demo-grocery-store-storefront
npm install algoliasearch react-instantsearch --legacy-peer-deps
```

This installs:
- `algoliasearch` - Algolia JavaScript client for search
- `react-instantsearch` - React components for building search UIs

### 4.2 Verify Installation

Check `package.json`:

```bash
grep -E "algoliasearch|react-instantsearch" package.json
```

You should see both packages listed in dependencies.

---

## Step 5: Storefront Configuration

### 5.1 Add Environment Variables

Create or update `demo-grocery-store-storefront/.env.local`:

```env
# Algolia Configuration (Public - Safe for client-side)
NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id_here
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_search_only_api_key_here
NEXT_PUBLIC_ALGOLIA_INDEX_NAME=products
```

**Important:**
- Use the **Search-Only API Key** (not Admin key) - this is safe to expose in client-side code
- Use the same `ALGOLIA_APP_ID` as in backend
- `NEXT_PUBLIC_ALGOLIA_INDEX_NAME` should match your index name (default: `products`)

### 5.2 Create Algolia Configuration File

Create `src/lib/algolia/config.ts`:

```typescript
"use client"

import { liteClient as algoliasearch } from "algoliasearch/lite"

const algoliaAppId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || ""
const algoliaSearchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY || ""

if (!algoliaAppId || !algoliaSearchKey) {
  console.warn(
    "Algolia is not configured. Set NEXT_PUBLIC_ALGOLIA_APP_ID and NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY environment variables."
  )
}

export const searchClient = algoliaAppId && algoliaSearchKey
  ? algoliasearch(algoliaAppId, algoliaSearchKey)
  : null

export const ALGOLIA_INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "products"

export const isAlgoliaConfigured = !!searchClient
```

---

## Step 6: Create Search Components

### 6.1 Create Algolia Search Component

Create `src/modules/search/components/algolia-search/index.tsx`:

```typescript
"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { MagnifyingGlass, XMark } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { useHits, useSearchBox, Configure } from "react-instantsearch"
import { searchClient, ALGOLIA_INDEX_NAME, isAlgoliaConfigured } from "@lib/algolia/config"
import { InstantSearch } from "react-instantsearch"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

type SearchResult = {
  objectID: string
  id: string
  title: string
  handle: string
  thumbnail?: string
  collection_handle?: string
}

function SearchBox() {
  const { query, refine, clear } = useSearchBox()
  const [inputValue, setInputValue] = useState(query)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setInputValue(query)
  }, [query])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    refine(inputValue)
  }

  const handleReset = () => {
    setInputValue("")
    clear()
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex-1">
      <div className="relative flex items-center bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover border border-ui-border-base rounded-md transition-colors focus-within:ring-2 focus-within:ring-ui-fg-base focus-within:border-transparent">
        <span className="absolute left-3 text-ui-fg-muted pointer-events-none">
          <MagnifyingGlass className="w-5 h-5" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            refine(e.target.value)
          }}
          placeholder="Search products..."
          className="w-full pl-10 pr-10 py-2.5 bg-transparent border-0 text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-0 text-sm"
          aria-label="Search products"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleReset}
            className="absolute right-3 text-ui-fg-muted hover:text-ui-fg-base transition-colors"
            aria-label="Clear search"
          >
            <XMark className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
  )
}

function SearchResults() {
  const { hits } = useHits<SearchResult>()
  const router = useRouter()
  const params = useParams()
  const countryCode = params?.countryCode as string

  if (hits.length === 0) {
    return (
      <div className="p-4 text-center text-ui-fg-subtle text-sm">
        No products found
      </div>
    )
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <ul className="divide-y divide-ui-border-base">
        {hits.map((hit) => (
          <li key={hit.objectID}>
            <LocalizedClientLink
              href={`/products/${hit.handle}`}
              className="flex items-center gap-4 p-4 hover:bg-ui-bg-subtle-hover transition-colors"
              onClick={() => router.push(`/${countryCode}/products/${hit.handle}`)}
            >
              <div className="relative w-16 h-16 shrink-0 bg-ui-bg-subtle rounded-md overflow-hidden">
                {hit.thumbnail ? (
                  <Thumbnail thumbnail={hit.thumbnail} size="square" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ui-fg-muted text-xs">
                    No image
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-ui-fg-base line-clamp-2">
                  {hit.title}
                </h3>
                {hit.collection_handle && (
                  <p className="text-xs text-ui-fg-subtle mt-1">
                    {hit.collection_handle}
                  </p>
                )}
              </div>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

type AlgoliaSearchProps = {
  className?: string
}

export default function AlgoliaSearch({ className }: AlgoliaSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  if (!isAlgoliaConfigured || !searchClient) {
    return null
  }

  return (
    <div ref={containerRef} className={clx("relative w-full max-w-xl", className)}>
      <InstantSearch
        searchClient={searchClient}
        indexName={ALGOLIA_INDEX_NAME}
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <Configure hitsPerPage={10} />
        <div className="relative">
          <div onClick={() => setIsOpen(true)}>
            <SearchBox />
          </div>
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-ui-border-base rounded-lg shadow-lg z-50">
              <SearchResults />
            </div>
          )}
        </div>
      </InstantSearch>
    </div>
  )
}
```

### 6.2 Update Header Search Component

Update `src/modules/layout/components/header-search/index.tsx`:

```typescript
"use client"

import { clx } from "@medusajs/ui"
import { isAlgoliaConfigured } from "@lib/algolia/config"
import AlgoliaSearch from "@modules/search/components/algolia-search"
import FallbackSearch from "./fallback-search"

export default function HeaderSearch({ className }: { className?: string }) {
  // Use Algolia if configured, otherwise fall back to basic search
  if (isAlgoliaConfigured) {
    return <AlgoliaSearch className={className} />
  }

  return <FallbackSearch className={className} />
}
```

---

## Step 7: Test the Integration

### 7.1 Start Backend

```bash
cd demo-grocery-store
npm run dev
```

**Verify:**
- ✅ Console shows: `✅ Algolia search plugin configured`
- ✅ No errors related to Algolia

### 7.2 Check Product Indexing

1. Go to Algolia Dashboard → **Indices** → **products**
2. You should see products indexed
3. If no products appear:
   - Create a test product in Medusa Admin
   - Or manually trigger reindexing (see Advanced Configuration)

### 7.3 Start Storefront

```bash
cd demo-grocery-store-storefront
npm run dev
```

### 7.4 Test Search

1. Open http://localhost:8000
2. Type in the search bar
3. You should see:
   - ✅ Instant search results as you type
   - ✅ Product thumbnails and titles
   - ✅ Clickable results that navigate to product pages

---

## How to Index Products in Algolia

Products are synced to Algolia in two ways: **automatically** (when you change products) and **by triggering updates** for existing data.

### Automatic indexing (default)

With the Medusa Algolia plugin configured and the backend running:

- **Create** a product → it is indexed in Algolia.
- **Update** a product (title, description, variants, etc.) → the Algolia record is updated.
- **Delete** a product → it is removed from the Algolia index.

No extra step is needed for new or changed products.

### Indexing existing products (first-time or reindex)

If you already have products in Medusa and the Algolia index is empty or out of date:

1. **Restart the backend**  
   Some setups run a full product index on startup. After setting `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY` in `demo-grocery-store/.env`, run:
   ```bash
   cd demo-grocery-store
   npm run dev
   ```
   Check the console for Algolia-related messages and then check the **products** index in the [Algolia Dashboard](https://www.algolia.com/dashboard) → **Indices**.

2. **Touch products in Medusa Admin**  
   Each create/update triggers indexing. To reindex existing products:
   - Open Medusa Admin (e.g. http://localhost:7001).
   - Open each product and **Save** (even without changes) to trigger an update and reindex that product in Algolia.

3. **Verify in Algolia**  
   - Go to [Algolia Dashboard](https://www.algolia.com/dashboard) → **Indices** → **products**.
   - Confirm that records appear and that attributes (title, handle, thumbnail, etc.) match what your storefront expects.

### Checklist

- Backend `.env` has `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY`.
- Backend is running (`npm run dev` in `demo-grocery-store`).
- Index name in the plugin matches the storefront (default: **products**).
- New and updated products are indexed automatically; for existing products, use restart and/or “Save” in Admin as above.

---

## Step-by-step: Export product data to JSON and upload to Algolia

Use this when you want to **extract product data from Medusa as JSON** and **upload it to Algolia** yourself (e.g. for a one-time bulk index, backup, or custom pipeline).

### Prerequisites

- Backend (`demo-grocery-store`) has the Algolia plugin configured and `.env` with:
  - `ALGOLIA_APP_ID`
  - `ALGOLIA_ADMIN_API_KEY`
- Node.js 20+ and npm.

---

### Step 1: Export products to JSON (and optionally upload in one go)

From the **backend** directory:

```bash
cd demo-grocery-store
npx medusa exec ./src/scripts/algolia-export-products.ts
```

What this does:

1. **Extract** – Loads all products from Medusa with relations: `variants`, `images`, `options`, and collection (when available).
2. **Transform** – Converts each product into the same shape your Algolia index expects (e.g. `objectID`, `title`, `handle`, `thumbnail`, `variant_sku`, `collection_title`, etc.), matching the transformer in `medusa-config.ts`.
3. **Write JSON** – Saves the transformed list to **`data/products-for-algolia.json`** in the backend folder.
4. **Optional upload** – If `algoliaService` is configured and env vars are set, it also **replaces** the Algolia index **`products`** with these records.

After running:

- You will have **`demo-grocery-store/data/products-for-algolia.json`** (array of objects, one per product).
- If upload ran, the Algolia index is already updated; you can skip Step 2.

---

### Step 2: Upload the JSON file to Algolia (if you didn't upload in Step 1)

Use this when you only exported to JSON (e.g. script said "Skipping upload") or when you want to re-upload an existing file.

From the **backend** directory:

```bash
cd demo-grocery-store
node scripts/upload-algolia-from-json.mjs
```

Requirements:

- **`data/products-for-algolia.json`** must exist (from Step 1).
- **`.env`** in the backend must contain `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_API_KEY` (the script loads `.env` from the backend root).

The script replaces the entire **`products`** index with the contents of the JSON file. Optional: set `ALGOLIA_INDEX_NAME` in `.env` if you use a different index name (default is `products`).

If you get `Cannot find module 'algoliasearch'`, install it in the backend: `npm install algoliasearch` (or use Step 1 with Algolia env vars set so the export script uploads for you).

---

### Step 3: Verify in Algolia

1. Open [Algolia Dashboard](https://www.algolia.com/dashboard) → **Indices** → **products**.
2. Confirm:
   - Record count matches your product count.
   - Records have the expected attributes: `objectID`, `title`, `handle`, `thumbnail`, `variant_sku`, `collection_title`, `collection_handle`, etc.
3. Test search in the Dashboard or in your storefront header search.

---

### JSON shape (for reference)

Each item in **`products-for-algolia.json`** looks like this (matches your plugin transformer):

```json
{
  "objectID": "prod_01...",
  "id": "prod_01...",
  "title": "Product name",
  "description": "Product description",
  "handle": "product-handle",
  "thumbnail": "https://...",
  "variants": [{ "id": "...", "title": "...", "sku": "..." }],
  "variant_sku": "SKU1 SKU2",
  "options": "Option1 Option2",
  "collection_title": "Collection name",
  "collection_handle": "collection-handle",
  "images": ["https://..."],
  "metadata": {}
}
```

- **`objectID`** is required by Algolia and must be unique (we use the product `id`).
- You can edit the JSON (e.g. fix titles or add fields) and then run **Step 2** again to re-upload.

---

### Summary

| Step | Command | Result |
|------|--------|--------|
| 1 | `npx medusa exec ./src/scripts/algolia-export-products.ts` | Creates `data/products-for-algolia.json` and optionally updates Algolia. |
| 2 | `node scripts/upload-algolia-from-json.mjs` | Uploads `data/products-for-algolia.json` to the Algolia `products` index. |
| 3 | Algolia Dashboard | Verify index and test search. |

---

## Troubleshooting

### Products Not Appearing in Search

**Problem:** Products aren't indexed in Algolia

**Solutions:**
1. **Check environment variables:**
   ```bash
   # Backend .env
   echo $ALGOLIA_APP_ID
   echo $ALGOLIA_ADMIN_API_KEY
   ```

2. **Check backend logs:**
   - Look for Algolia-related errors
   - Verify plugin is loaded: `✅ Algolia search plugin configured`

3. **Manually trigger indexing:**
   - Create or update a product in Medusa Admin
   - Products should auto-index

4. **Check Algolia Dashboard:**
   - Go to **Indices** → **products**
   - Verify index exists and has records

### Search Not Working in Storefront

**Problem:** Search bar doesn't show results

**Solutions:**
1. **Check environment variables:**
   ```bash
   # Storefront .env.local
   echo $NEXT_PUBLIC_ALGOLIA_APP_ID
   echo $NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY
   ```

2. **Check browser console:**
   - Look for Algolia-related errors
   - Verify `isAlgoliaConfigured` is `true`

3. **Verify API keys:**
   - Use **Search-Only API Key** (not Admin key) for frontend
   - Ensure keys match your Algolia app

4. **Check index name:**
   - Default is `products`
   - Verify `NEXT_PUBLIC_ALGOLIA_INDEX_NAME` matches your index

### Dependency Conflicts

**Problem:** `npm install` fails with peer dependency errors

**Solution:**
```bash
npm install medusa-plugin-algolia --legacy-peer-deps
```

Or add to `.npmrc`:
```
legacy-peer-deps=true
```

### Build Errors

**Problem:** `Module not found: Can't resolve 'react-instantsearch'`

**Solution:**
```bash
cd demo-grocery-store-storefront
npm install react-instantsearch --legacy-peer-deps
npm run dev
```

---

## Advanced Configuration

### Customize Searchable Attributes

Edit `medusa-config.ts` to change which fields are searchable:

```typescript
searchableAttributes: [
  "title",
  "description",
  "tags",
  "collection_title",
  "variant_sku",
  "options",
  // Add custom attributes here
],
```

### Configure Index Settings in Algolia Dashboard

1. Go to **Indices** → **products** → **Configuration**
2. **Ranking & Sorting:**
   - Customize how results are ranked
   - Add custom ranking attributes
3. **Facets:**
   - Add filters for categories, price ranges, etc.
4. **Synonyms:**
   - Add search synonyms (e.g., "veggie" → "vegetable")

### Manual Reindexing

If you need to reindex all products:

1. **Via Algolia Dashboard:**
   - Go to **Indices** → **products** → **Settings**
   - Use "Clear all records" and let products reindex automatically

2. **Via Medusa Admin:**
   - Some versions have a "Reindex" button in product settings

### Customize Search Results Display

Edit `src/modules/search/components/algolia-search/index.tsx` to:
- Show product prices
- Add filters (price, category, etc.)
- Change result layout
- Add "View all results" link

### Add Search Analytics

1. Go to Algolia Dashboard → **Analytics**
2. Enable search analytics
3. Track popular searches, click-through rates, etc.

---

## Features Enabled

✅ **Instant Search** - Results appear as you type  
✅ **Autocomplete** - Product suggestions while typing  
✅ **Typo Tolerance** - Algolia handles typos automatically  
✅ **Fast Results** - Sub-100ms search response times  
✅ **Automatic Indexing** - Products indexed on create/update/delete  
✅ **Fallback Support** - Gracefully falls back to basic search if Algolia isn't configured  

---

## Next Steps

- Configure search synonyms for better results
- Add filters (price, category, etc.) to search results
- Customize ranking rules in Algolia Dashboard
- Add search analytics tracking
- Implement search suggestions/autocomplete
- Add "View all results" page with pagination

---

## Resources

- [Algolia Documentation](https://www.algolia.com/doc/)
- [Medusa Algolia Plugin Docs](https://docs.medusajs.com/plugins/search/algolia)
- [React InstantSearch Docs](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react/)
- [Algolia Dashboard](https://www.algolia.com/dashboard)

---

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Algolia Dashboard for index status
3. Check backend and storefront console logs
4. Verify all environment variables are set correctly
