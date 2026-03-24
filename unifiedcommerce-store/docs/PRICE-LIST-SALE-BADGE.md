# How to Show "Save X%" Badge via a Sale Price List

When you use a **price list of type "sale"** (instead of only a cart-level promotion like SUMMER15), the store API returns a lower `calculated_amount` and the storefront shows the **"Save X%"** badge automatically—no product tags needed.

---

## Step-by-step: Create a sale price list

### 1. Open Price Lists in Medusa Admin

1. Log in to your Medusa Admin (e.g. `https://your-backend.com/app`).
2. In the **sidebar**, go to **Price Lists** (under Pricing or similar).
3. Click **Create price list** (or **New price list**).

### 2. Create the price list and set type to "Sale"

1. **Title**: e.g. `SUMMER15` or `Produce Sale`.
2. **Description** (optional): e.g. `15% off produce`.
3. **Type**: set to **Sale** (not "Override").  
   This is what makes the store API return `price_list_type: "sale"` and both `original_amount` and `calculated_amount`, so the badge can show "Save X%".
4. **Status**: **Active**.
5. **Start / End date** (optional): when the sale is valid.
6. **Customer groups** (optional): leave empty to apply to everyone, or select a group.
7. Save the price list so you get a price list ID.

### 3. Add sale prices for the products you want on sale

You need to add one **price** per variant (or per product if one variant per product) that should show the badge.

For each product/variant you want on sale (e.g. produce items):

1. In the price list detail, go to the **Prices** (or **Add prices**) section.
2. **Add price** (or “Add variant prices”):
   - **Variant** (or **Product**): choose the product variant (e.g. Organic Bananas, 1 lb).
   - **Currency**: your store currency (e.g. USD).
   - **Amount**: the **sale price** in the smallest unit (e.g. **cents**).  
     Example: for $2.99 sale price enter `299`; for $0.99 enter `99`.
3. Repeat for every produce variant (or every variant you want in the sale).

If the UI shows “Price set” instead of “Variant”, you must use the **price set ID** that belongs to each variant. In Medusa v2 each variant has a `price_set_id`; the price list price must reference that ID.

### 4. Confirm the storefront gets the sale price

1. Open your **storefront** (e.g. category page for Produce).
2. Call the store API (or inspect network):  
   `GET /store/products?region_id=<your_region_id>&...`  
   and ensure the response includes `*variants.calculated_price` (or equivalent).
3. For a variant that has a sale price in the price list, the API should return something like:
   - `calculated_price.calculated_amount`: sale price (e.g. 299 cents).
   - `calculated_price.original_amount`: original price (e.g. 349 cents).
   - `calculated_price.calculated_price.price_list_type`: `"sale"` (if the API exposes it).

When that’s true, the storefront logic already treats it as a sale and shows **"Save X%"** (and optionally dollar savings) on both PLP and PDP.

### 5. Optional: restrict by region

If your price list UI supports **rules**:

- Add a rule e.g. **region_id** = your store region(s) so the sale only applies where you want.
- The store API uses `region_id` (and currency) when calculating prices, so only matching regions will see the sale and the badge.

---

## If your Admin doesn’t have a full Price List UI

Some setups expose price lists only via API. You can create the same behavior with a **backend script** that:

1. Uses the **Pricing Module** (or **createPriceLists** workflow) to create a price list with `type: "sale"`.
2. For each produce variant (or desired product variant):
   - Resolves the variant’s **price_set_id**.
   - Adds a price to the price list: `price_set_id`, `currency_code`, `amount` (sale price in minor units).

Example (conceptual):

```ts
// Pseudocode: create price list and add sale prices
const priceList = await pricingModuleService.createPriceLists([{
  title: "SUMMER15 Produce",
  description: "Summer sale on produce",
  type: "sale",
  status: "active",
  prices: [
    { currency_code: "usd", amount: 299, price_set_id: "<variant_A_price_set_id>" },
    { currency_code: "usd", amount: 199, price_set_id: "<variant_B_price_set_id>" },
    // ... one per variant on sale
  ],
}])
```

Amounts are in **minor units** (cents for USD). The variant’s **price_set_id** comes from the product/variant data (e.g. from `listProducts` or Admin API with fields including variant price set).

---

## Summary

| Goal                         | Action |
|-----------------------------|--------|
| Badge shows **"Save X%"**   | Use a **price list** with **type = Sale** and add **sale prices** per variant (price_set_id + amount + currency). |
| Badge shows **"Save with SUMMER15"** (no price change on listing) | Use a **cart-level promotion** (e.g. code SUMMER15) and add the **SUMMER15** **tag** to those products so the tag-based badge shows. |

Using a sale price list is better when you want the **exact savings** (X% or $) to appear on PLP/PDP without the customer adding a code.
