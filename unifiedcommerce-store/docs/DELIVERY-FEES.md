# Delivery Fees: By Market, Order Size, and Time Slot

Yes, **Medusa supports different delivery fees** by market, order size, and time slot. Below is how each is supported and how you can implement it.

---

## 1. By market (region / location)

**Supported natively.**

- **Service zones**  
  Each shipping option is tied to a **service zone**. You can create multiple zones (e.g. “California”, “Texas”, “New York”) with different **geo** (countries, provinces, cities). Each zone can have its own set of shipping options and prices.

- **Prices per region**  
  When creating a shipping option you pass **prices** that can be:
  - **By `region_id`**: e.g. one amount for region “US West”, another for “US East”.
  - **By `currency_code`**: e.g. USD vs EUR.

**Example (from your seed):**  
`seed.ts` already creates options with `prices: [{ region_id: region.id, amount: 10 }, ...]`. To support multiple markets, create more **fulfillment sets** and **service zones** per geography, then create shipping options per zone with different `amount` values in `prices`.

**Admin:**  
Regions and shipping options are managed per region in the Medusa Admin (Regions → Shipping Options). You can add multiple options per region with different flat amounts.

---

## 2. By order size (cart total / weight / quantity)

**Supported via calculated pricing and/or price rules.**

- **`price_type: "calculated"`**  
  Use a **custom fulfillment provider** that implements `calculatePrice()`. The provider receives the cart (items, total, address, etc.) and returns a price (e.g. free over $50, or tiered by subtotal). So “by order size” is implemented in your provider logic.

- **Price rules (Pricing Module)**  
  Medusa’s pricing layer supports **rules** on prices (e.g. attribute `cart_subtotal`, operator `gte`, value `5000` for free shipping). Shipping option prices can be associated with such rules so the same option shows different amounts (or free) based on cart total.

- **Tiered prices**  
  Some flows support **min_quantity** / **max_quantity** on prices (e.g. for quantity-based tiers). For shipping, the typical approach is either **calculated** (provider) or **rules** (cart total).

**Implementation:**  
- Add a custom fulfillment provider that computes delivery fee from cart total (and optionally weight/quantity).  
- Or configure price rules on shipping option prices so that the displayed price changes by cart total (e.g. free over threshold).  
See [Fulfillment Module](https://docs.medusajs.com/resources/commerce-modules/fulfillment/shipping-option) and [Price Rules](https://docs.medusajs.com/resources/commerce-modules/pricing/price-rules).

---

## 3. By time slot (delivery speed / slot)

**Supported by defining multiple shipping options.**

- **Different options = different “slots”**  
  You already have “Standard” and “Express” in `seed.ts`. Each option has its own:
  - **type** (e.g. `code: "standard"` vs `code: "express"`)
  - **prices** (e.g. $5 standard, $15 express)
  - **description** (e.g. “Ship in 2–3 days” vs “Ship in 24 hours”)

- **More “time slots”**  
  Add more shipping options for the same (or different) service zones, e.g.:
  - “Next-day delivery” – flat or calculated price
  - “Same-day delivery” – higher fee
  - “Economy” – lower fee, slower

Each option is a separate line in checkout; the customer picks one. So “time slot” is modeled as **which shipping option they choose**, not a separate slot entity. If you need to pass a specific slot (e.g. “Tuesday 2–4pm”) to a carrier, store it in the option’s **`data`** or in fulfillment metadata.

---

## Summary

| Requirement        | How Medusa supports it |
|--------------------|-------------------------|
| **By market**      | Multiple service zones + prices per `region_id` (and currency). |
| **By order size**  | `price_type: "calculated"` in a custom provider and/or price rules (e.g. cart total). |
| **By time slot**   | Multiple shipping options (Standard, Express, Next-day, etc.) with different prices and types. |

Your existing seed (`createShippingOptionsWorkflow` with flat prices per region) already gives you **different fees by market** (per region) and **by “time slot”** (Standard vs Express). For **order-size–based fees** (e.g. free over $X, or tiers), add either a **calculated** fulfillment provider or **price rules** on the shipping option prices.

---

## Implemented: Dynamic delivery/pickup fee by order value

This project includes a **dynamic delivery provider** (`src/fulfillment/dynamic-delivery-provider.ts`) and two shipping options:

- **Delivery** and **Pickup** (slots) with **calculated** pricing:
  - **Order value ≥ $50**: delivery/pickup fee = **5%** of order value
  - **Order value < $50**: delivery/pickup fee = **10%** of order value

The provider is registered in `medusa-config.ts` and the options are seeded in `src/scripts/seed.ts`. The storefront shows Delivery and Pickup in checkout and calls the store API to get the calculated price for the current cart.

### If you only see "Standard" and "Express" (no "Delivery" / "Pickup")

Dynamic shipping (Delivery and Pickup with 5%/10% fee) only appears if the backend has the provider and options. Do this:

1. **Restart the Medusa backend**  
   So `medusa-config.ts` is reloaded and the `dynamic_delivery` fulfillment provider is registered.

2. **Run the seed** (creates Delivery and Pickup options and links the provider to the stock location):
   ```bash
   cd unifiedcommerce-grocery-store
   npx medusa exec ./src/scripts/seed.ts
   ```
   If you use a **deployed** backend, run the same command against that environment (e.g. connect to the deployed DB and run the seed, or run it in a job that has DB access).

3. **Hard refresh or clear cache** when opening checkout (storefront now uses `cache: "no-store"` for shipping options so you get fresh data).

4. **Set a shipping address on the cart**  
   The store only returns shipping options when the cart has a valid shipping address for the region.

After this, checkout should show **Delivery** and **Pickup** with a calculated price (e.g. 5% of $60 = $3 for a $60 cart).
