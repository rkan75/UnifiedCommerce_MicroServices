# Contentful Weekly Ad Setup Guide

This guide walks you through setting up a Weekly Ad/Deals page using Contentful CMS.

## Overview

We'll replace the mock data (`MOCK_WEEKLY_AD`) with dynamic content from Contentful. The setup includes:

1. **Contentful Setup**: Create content types and entries in Contentful
2. **Data Layer**: Create a data fetching function
3. **Page Update**: Update the weekly ad page to use Contentful data
4. **Fallback**: Keep mock data as fallback if Contentful fails

---

## Step 1: Set Up Contentful Content Types

### 1.1 Create "WeeklyAdDeal" Content Type

1. Go to your Contentful space: https://app.contentful.com
2. Navigate to **Content model** → **Add content type**
3. Name it: `weeklyAdDeal`
4. Add the following fields:

| Field ID | Field Name | Type | Required | Validation |
|----------|------------|------|----------|------------|
| `title` | Title | Short text | Yes | - |
| `description` | Description | Long text | No | - |
| `category` | Category | Short text | Yes | - |
| `image` | Image | Media | No | Images only |
| `productHandle` | Product Handle | Short text | **Yes** | Should match product handle in Medusa |
| `productId` | Product ID | Short text | No | Alternative to productHandle |
| `promotionalText` | Promotional Text | Short text | No | e.g., "Save 30%", "Special Price" |
| `validThrough` | Valid Through | Date & time | No | - |

**Important**: 
- **Prices are NOT stored in Contentful** - they are fetched from your Medusa product database
- You must provide either `productHandle` or `productId` to link the deal to a product
- The application will automatically fetch current prices from the product

**Settings:**
- Display field: `title`
- Description: "A single deal/item in the weekly ad"

### 1.2 Create "WeeklyAd" Content Type

1. Create another content type: `weeklyAd`
2. Add the following fields:

| Field ID | Field Name | Type | Required | Validation |
|----------|------------|------|----------|------------|
| `title` | Title | Short text | Yes | - |
| `description` | Description | Long text | No | - |
| `startDate` | Start Date | Date & time | Yes | - |
| `endDate` | End Date | Date & time | Yes | - |
| `coverImage` | Cover Image | Media | No | Images only |
| `featuredDeals` | Featured Deals | References (many) | Yes | Content type: `weeklyAdDeal` |

**Settings:**
- Display field: `title`
- Description: "Weekly ad with deals and date range"

### 1.3 Publish Content Types

1. Click **Save** on each content type
2. Click **Publish** to make them available

---

## Step 2: Create Content in Contentful

### 2.1 Create Deal Entries

1. Go to **Content** → **Add entry** → Select `weeklyAdDeal`
2. Create several deals, for example:

**Deal 1:**
- Title: `Organic Bananas`
- Category: `Produce`
- **Product Handle**: `organic-bananas` (Required - must match product handle in Medusa)
- (Optional) Description: `Fresh organic bananas, perfect for smoothies`
- (Optional) Promotional Text: `Save 30%`
- (Optional) Image: Upload banana image
- (Optional) Valid Through: `2026-02-15T23:59:59Z`

**Note**: Prices ($0.69, was $0.99) will be automatically fetched from the product in your Medusa database.

**Deal 2:**
- Title: `Fresh Whole Milk`
- Category: `Dairy`
- **Product Handle**: `fresh-whole-milk` (Required)
- (Optional) Promotional Text: `Special Price`

**Deal 3:**
- Title: `Farm Fresh Eggs`
- Category: `Dairy`
- **Product Handle**: `farm-fresh-eggs` (Required)

**Deal 4:**
- Title: `Whole Chicken`
- Category: `Meat`
- **Product Handle**: `whole-chicken` (Required)
- (Optional) Description: `Fresh whole chicken, per pound`

3. **Publish** each deal entry

### 2.2 Create Weekly Ad Entry

1. Go to **Content** → **Add entry** → Select `weeklyAd`
2. Fill in the fields:

- **Title**: `This Week's Deals`
- **Description**: `Save on groceries this week. Valid in-store and online.`
- **Start Date**: Select the start of the current week (e.g., Sunday)
- **End Date**: Select the end of the current week (e.g., Saturday)
- **Featured Deals**: Click **Add reference** and select all the deals you created
- (Optional) **Cover Image**: Upload a cover image

3. **Publish** the weekly ad entry

---

## Step 3: Get Your Contentful Credentials

1. Go to **Settings** → **API keys**
2. Copy:
   - **Space ID** (e.g., `xurz88qk7d3f`)
   - **Content Delivery API - access token** (e.g., `qLWenEWxIs72ntOdM8fs6ph-o2qRSA7wuWWrPwrXUXw`)

3. Verify these are already in your `.env.local`:
   ```env
   NEXT_PUBLIC_CONTENTFUL_SPACE_ID=xurz88qk7d3f
   NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN=qLWenEWxIs72ntOdM8fs6ph-o2qRSA7wuWWrPwrXUXw
   NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT=master
   ```

---

## Step 4: Create Data Fetching Layer

The code has been created in `src/lib/data/contentful-weekly-ad.ts`. This file:

- Fetches weekly ad entries from Contentful
- Handles date filtering (to get current/active ads)
- Parses and normalizes the data
- Falls back to mock data if Contentful fails

---

## Step 5: Update the Weekly Ad Page

The page at `src/app/[countryCode]/(main)/weekly-ad/page.tsx` has been updated to:

1. Try fetching from Contentful first
2. Fall back to mock data if Contentful is unavailable
3. Handle date formatting
4. Group deals by category

---

## Step 6: Test the Integration

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Visit the weekly ad page**:
   ```
   http://localhost:8000/us/weekly-ad
   ```

3. **Verify**:
   - Content loads from Contentful
   - Deals are displayed correctly
   - Date range shows properly
   - Categories are grouped correctly

4. **Test fallback**:
   - Temporarily set wrong credentials in `.env.local`
   - Verify mock data still displays

---

## Step 7: Content Management Workflow

### Weekly Updates

1. **Create new deals** in Contentful (`weeklyAdDeal` entries)
2. **Create a new weekly ad** (`weeklyAd` entry) with:
   - New date range (start/end dates)
   - References to the new deals
3. **Publish** the new weekly ad
4. The page will automatically show the active weekly ad based on dates

### Multiple Active Ads

The current implementation fetches the **most recent** weekly ad. To show multiple ads:

1. Modify `getWeeklyAd()` to return multiple entries
2. Update the page to display multiple ads
3. Add filtering by date range

---

## Troubleshooting

### Content Not Showing

1. **Check Contentful credentials**:
   ```bash
   # Verify .env.local has correct values
   cat .env.local | grep CONTENTFUL
   ```

2. **Check Contentful entries**:
   - Ensure entries are **Published** (not just saved)
   - Verify content type IDs match: `weeklyAd` and `weeklyAdDeal`

3. **Check browser console**:
   - Look for Contentful API errors
   - Verify network requests to Contentful

4. **Check server logs**:
   - Look for fetch errors
   - Verify date ranges are valid

### Date Range Issues

- Ensure `startDate` and `endDate` are valid Date fields in Contentful
- Dates should be in ISO format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`

### Images Not Loading

- Ensure images are uploaded and published in Contentful
- Check image URLs in the browser network tab
- Verify Contentful image URLs are accessible

---

## Advanced: Querying by Date Range

To fetch weekly ads for a specific date range:

```typescript
// In contentful-weekly-ad.ts, you can add:
url.searchParams.set("fields.startDate[lte]", targetDate)
url.searchParams.set("fields.endDate[gte]", targetDate)
```

---

## Next Steps

1. **Add localization**: Support multiple languages using Contentful locales
2. **Add images**: Upload product images to Contentful and display them
3. **Link to products**: Use `productHandle` to link deals to actual products
4. **Add promotions**: Integrate with Medusa promotions API
5. **Add analytics**: Track which deals are viewed/clicked

---

## File Structure

```
src/
├── lib/
│   ├── contentful/
│   │   └── config.ts                    # Contentful config (already exists)
│   └── data/
│       └── contentful-weekly-ad.ts      # NEW: Data fetching layer
├── modules/
│   └── home/
│       └── components/
│           └── weekly-ad/
│               └── weekly-ad-data.ts    # Mock data (fallback)
└── app/
    └── [countryCode]/
        └── (main)/
            └── weekly-ad/
                └── page.tsx              # UPDATED: Uses Contentful
```

---

## Summary

✅ **Contentful Setup**: Created `weeklyAd` and `weeklyAdDeal` content types  
✅ **Data Layer**: Created `getWeeklyAd()` function  
✅ **Page Update**: Updated page to use Contentful with fallback  
✅ **Testing**: Verify content loads correctly  

The weekly ad page now pulls content from Contentful, making it easy to update deals weekly without code changes!
