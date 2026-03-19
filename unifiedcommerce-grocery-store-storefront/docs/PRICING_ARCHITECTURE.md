# Pricing Architecture: Contentful vs Database

## Overview

**Prices should ALWAYS come from your product database (Medusa), NOT from Contentful.**

This document explains why and how the weekly ad system handles pricing.

---

## Why Prices Come from Database

### 1. **Single Source of Truth**
- Product prices are managed in Medusa
- Prices can change frequently (sales, promotions, inventory)
- Having prices in two places creates inconsistency risk

### 2. **Dynamic Pricing**
- Prices vary by region/currency
- Prices can have promotions/discounts applied
- Prices sync with inventory levels
- Prices can be calculated dynamically

### 3. **Data Consistency**
- Avoids price mismatches between Contentful and database
- Ensures customers see accurate, current prices
- Prevents checkout errors from stale prices

### 4. **Business Logic**
- Medusa handles complex pricing rules
- Supports price lists, promotions, discounts
- Calculates taxes, shipping, etc.

---

## How It Works

### Contentful Stores:
- ✅ **Product Reference**: `productHandle` or `productId` (links to Medusa product)
- ✅ **Deal Metadata**: Title, description, category, promotional text
- ✅ **Marketing Content**: Images, deal descriptions, valid dates
- ❌ **NOT Prices**: Prices are fetched from Medusa

### Application Flow:

```
1. Fetch deal entry from Contentful
   ↓
2. Extract productHandle/productId
   ↓
3. Fetch product from Medusa using handle/ID
   ↓
4. Get current price from product.variants[0].calculated_price
   ↓
5. Calculate wasPrice from original_price (if different)
   ↓
6. Display deal with real-time prices
```

---

## Contentful Content Type Structure

### weeklyAdDeal Fields:

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `title` | Short text | ✅ Yes | Deal title |
| `productHandle` | Short text | ✅ Yes | Links to Medusa product |
| `productId` | Short text | ❌ No | Alternative to handle |
| `category` | Short text | ✅ Yes | Deal category |
| `description` | Long text | ❌ No | Deal description |
| `promotionalText` | Short text | ❌ No | e.g., "Save 30%" |
| `image` | Media | ❌ No | Deal image |
| `validThrough` | Date | ❌ No | Expiration date |

**Note**: No `price` or `wasPrice` fields - these come from the database!

---

## Example: Creating a Deal Entry

### In Contentful:

```
Title: Organic Bananas
Product Handle: organic-bananas
Category: Produce
Description: Fresh organic bananas
Promotional Text: Save 30%
Image: [Upload image]
```

### What Happens:

1. Application reads `productHandle: "organic-bananas"`
2. Fetches product from Medusa: `GET /store/products?handle=organic-bananas`
3. Gets price: `product.variants[0].calculated_price.calculated_price = "$0.69"`
4. Gets original price: `product.variants[0].calculated_price.original_price = "$0.99"`
5. Displays: **$0.69** (was $0.99)

---

## Price Calculation Logic

The application uses `getProductPrice()` which:

1. Finds cheapest variant with `calculated_price`
2. Gets `calculated_price` (current/sale price)
3. Gets `original_price` (regular price)
4. Formats prices using `convertToLocale()`
5. Handles currency conversion
6. Supports price lists and promotions

---

## Fallback Behavior

If product is not found:
- Deal still displays (from Contentful)
- Price shows: "Price unavailable"
- User can still see deal information
- Link to product page may not work

---

## Benefits of This Approach

✅ **Always Accurate**: Prices are always current  
✅ **No Sync Issues**: Single source of truth  
✅ **Supports Promotions**: Medusa handles discounts automatically  
✅ **Multi-Region**: Prices adjust by region/currency  
✅ **Easy Updates**: Change prices in Medusa, deals update automatically  

---

## Migration from Static Prices

If you previously stored prices in Contentful:

1. **Remove** `price` and `wasPrice` fields from Contentful
2. **Add** `productHandle` or `productId` to each deal
3. **Verify** product handles match your Medusa products
4. **Test** that prices display correctly

---

## Troubleshooting

### Prices Not Showing

**Problem**: Deal shows "Price unavailable"

**Solutions**:
1. Check `productHandle` matches product handle in Medusa
2. Verify product exists and is published
3. Ensure product has variants with prices
4. Check product is available in the region

### Wrong Prices Displayed

**Problem**: Prices don't match expected values

**Solutions**:
1. Check Medusa product prices directly
2. Verify price lists/promotions are configured correctly
3. Check region/currency settings
4. Verify `calculated_price` is populated

### Product Not Found

**Problem**: Deal doesn't link to product

**Solutions**:
1. Verify `productHandle` spelling matches exactly
2. Check product is published in Medusa
3. Ensure product is available in the region
4. Try using `productId` instead of `productHandle`

---

## Best Practices

1. **Always use productHandle**: More SEO-friendly than IDs
2. **Keep handles consistent**: Use same format as product URLs
3. **Test after creating deals**: Verify prices display correctly
4. **Monitor price changes**: Prices update automatically, but verify
5. **Use promotionalText**: Add marketing copy like "Save 30%" for context

---

## Summary

- ✅ **Contentful**: Stores deal metadata, product references, marketing content
- ✅ **Medusa Database**: Stores and calculates actual product prices
- ✅ **Application**: Fetches prices from database and displays with deal info
- ❌ **Never**: Store prices statically in Contentful

This architecture ensures prices are always accurate, up-to-date, and consistent across your storefront.
