# Contentful Sample Data for Weekly Ad Deals

Sample data entries for the `weeklyAdDeal` content type. Use these as examples when creating entries in Contentful.

**⚠️ Important**: Prices are NOT stored in Contentful - they are fetched from your Medusa product database. You only need to provide the `productHandle` or `productId` to link the deal to a product.

## Content Type: weeklyAdDeal

### Sample Deal 1: Organic Bananas (Produce)

```json
{
  "title": "Organic Bananas",
  "description": "Fresh organic bananas, perfect for smoothies and snacks",
  "category": "Produce",
  "productHandle": "organic-bananas",
  "promotionalText": "Save 30%",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Organic Bananas` ✅ Required
- **Category**: `Produce` ✅ Required
- **Product Handle**: `organic-bananas` ✅ **Required** (must match product handle in Medusa)
- **Description**: `Fresh organic bananas, perfect for smoothies and snacks` (optional)
- **Promotional Text**: `Save 30%` (optional - marketing copy)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload banana image (optional)

**Note**: Prices ($0.69, was $0.99) will be automatically fetched from the product in your Medusa database. Make sure a product with handle `organic-bananas` exists in Medusa.

---

### Sample Deal 2: Fresh Whole Milk (Dairy)

```json
{
  "title": "Fresh Whole Milk",
  "description": "Farm-fresh whole milk, 1 gallon",
  "category": "Dairy",
  "productHandle": "fresh-whole-milk",
  "promotionalText": "Special Price",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Fresh Whole Milk` ✅ Required
- **Category**: `Dairy` ✅ Required
- **Product Handle**: `fresh-whole-milk` ✅ **Required**
- **Description**: `Farm-fresh whole milk, 1 gallon` (optional)
- **Promotional Text**: `Special Price` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload milk image (optional)

---

### Sample Deal 3: Farm Fresh Eggs (Dairy)

```json
{
  "title": "Farm Fresh Eggs",
  "description": "Large grade A eggs, 1 dozen",
  "price": "$3.49",
  "wasPrice": "$4.29",
  "category": "Dairy",
  "productHandle": "farm-fresh-eggs",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Farm Fresh Eggs`
- **Description**: `Large grade A eggs, 1 dozen`
- **Price**: `$3.49`
- **Was Price**: `$4.29`
- **Category**: `Dairy`
- **Product Handle**: `farm-fresh-eggs` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload eggs image (optional)

---

### Sample Deal 4: Whole Chicken (Meat)

```json
{
  "title": "Whole Chicken",
  "description": "Fresh whole chicken, per pound",
  "price": "$1.29/lb",
  "wasPrice": "$1.99/lb",
  "category": "Meat",
  "productHandle": "whole-chicken",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Whole Chicken`
- **Description**: `Fresh whole chicken, per pound`
- **Price**: `$1.29/lb`
- **Was Price**: `$1.99/lb`
- **Category**: `Meat`
- **Product Handle**: `whole-chicken` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload chicken image (optional)

---

### Sample Deal 5: Organic Broccoli (Produce)

```json
{
  "title": "Organic Broccoli",
  "description": "Fresh organic broccoli crowns",
  "price": "$1.49",
  "wasPrice": "$1.99",
  "category": "Produce",
  "productHandle": "organic-broccoli",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Organic Broccoli`
- **Description**: `Fresh organic broccoli crowns`
- **Price**: `$1.49`
- **Was Price**: `$1.99`
- **Category**: `Produce`
- **Product Handle**: `organic-broccoli` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload broccoli image (optional)

---

### Sample Deal 6: Greek Yogurt (Dairy)

```json
{
  "title": "Greek Yogurt 32oz",
  "description": "Creamy Greek yogurt, 32 ounce container",
  "price": "$4.99",
  "wasPrice": "$5.99",
  "category": "Dairy",
  "productHandle": "greek-yogurt-32oz",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Greek Yogurt 32oz`
- **Description**: `Creamy Greek yogurt, 32 ounce container`
- **Price**: `$4.99`
- **Was Price**: `$5.99`
- **Category**: `Dairy`
- **Product Handle**: `greek-yogurt-32oz` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload yogurt image (optional)

---

### Sample Deal 7: Ground Beef (Meat)

```json
{
  "title": "Ground Beef 80/20",
  "description": "Fresh ground beef, 1 lb package",
  "price": "$4.99",
  "wasPrice": "$6.49",
  "category": "Meat",
  "productHandle": "ground-beef-80-20",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Ground Beef 80/20`
- **Description**: `Fresh ground beef, 1 lb package`
- **Price**: `$4.99`
- **Was Price**: `$6.49`
- **Category**: `Meat`
- **Product Handle**: `ground-beef-80-20` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload ground beef image (optional)

---

### Sample Deal 8: Fresh Strawberries (Produce)

```json
{
  "title": "Fresh Strawberries",
  "description": "Sweet California strawberries, 1 lb container",
  "price": "$2.99",
  "wasPrice": "$4.99",
  "category": "Produce",
  "productHandle": "fresh-strawberries",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Fresh Strawberries`
- **Description**: `Sweet California strawberries, 1 lb container`
- **Price**: `$2.99`
- **Was Price**: `$4.99`
- **Category**: `Produce`
- **Product Handle**: `fresh-strawberries` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload strawberries image (optional)

---

### Sample Deal 9: Artisan Bread (Bakery)

```json
{
  "title": "Artisan Sourdough Bread",
  "description": "Fresh baked sourdough bread, 1 loaf",
  "price": "$3.99",
  "wasPrice": "$5.49",
  "category": "Bakery",
  "productHandle": "artisan-sourdough-bread",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Artisan Sourdough Bread`
- **Description**: `Fresh baked sourdough bread, 1 loaf`
- **Price**: `$3.99`
- **Was Price**: `$5.49`
- **Category**: `Bakery`
- **Product Handle**: `artisan-sourdough-bread` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload bread image (optional)

---

### Sample Deal 10: Organic Spinach (Produce)

```json
{
  "title": "Organic Baby Spinach",
  "description": "Fresh organic baby spinach, 5 oz bag",
  "price": "$2.49",
  "wasPrice": "$3.49",
  "category": "Produce",
  "productHandle": "organic-baby-spinach",
  "validThrough": "2026-02-15T23:59:59Z"
}
```

**Fields to fill in Contentful:**
- **Title**: `Organic Baby Spinach`
- **Description**: `Fresh organic baby spinach, 5 oz bag`
- **Price**: `$2.49`
- **Was Price**: `$3.49`
- **Category**: `Produce`
- **Product Handle**: `organic-baby-spinach` (optional)
- **Valid Through**: `2026-02-15T23:59:59Z` (optional)
- **Image**: Upload spinach image (optional)

---

## Category Reference

Common categories to use:
- `Produce` - Fruits and vegetables
- `Dairy` - Milk, eggs, cheese, yogurt
- `Meat` - Beef, chicken, pork, fish
- `Bakery` - Bread, pastries, baked goods
- `Beverages` - Drinks, juices, sodas
- `Frozen` - Frozen foods
- `Pantry` - Canned goods, dry goods
- `Snacks` - Chips, crackers, snacks
- `Deli` - Deli meats and cheeses

---

## Product Handle Tips

- **Must match exactly** the product handle in your Medusa database
- Use lowercase with hyphens: `organic-bananas`, `fresh-whole-milk`
- Check product handles in Medusa admin: Products → [Product] → Handle field
- Product handles are usually the same as product URLs: `/products/organic-bananas`

## Promotional Text Tips

- Use for marketing copy: `Save 30%`, `Special Price`, `Limited Time`
- Prices are fetched from database, but promotional text adds context
- Examples:
  - `Save 30%`
  - `Special Price`
  - `Buy 2 Get 1 Free`
  - `Limited Time Offer`

---

## Date Format for Valid Through

Use ISO 8601 format:
- `2026-02-15T23:59:59Z` (UTC)
- `2026-02-15` (date only, defaults to start of day)

---

## Quick Copy-Paste Template

When creating a new deal entry, use this template:

```
Title: [Product Name] ✅ Required
Category: [Category name] ✅ Required
Product Handle: [product-handle-slug] ✅ Required (must match Medusa product)
Description: [Brief description] (optional)
Promotional Text: [Save 30%] (optional)
Valid Through: [ISO date] (optional)
Image: [Upload image] (optional)
```

---

## Notes

1. **Required Fields**: `title`, `category`, `productHandle` must be filled
2. **Optional Fields**: `description`, `promotionalText`, `image`, `validThrough` can be left empty
3. **Category**: Use consistent category names (case-sensitive)
4. **Product Handle**: Must match exactly the product handle in Medusa (check in Medusa admin)
5. **Prices**: Are fetched automatically from Medusa - do NOT store prices in Contentful
6. **Images**: Upload high-quality product images (recommended: 800x800px or larger)
7. **Publishing**: Remember to **Publish** entries after creating them (not just Save)
8. **Testing**: After creating a deal, verify the product exists in Medusa and prices display correctly
