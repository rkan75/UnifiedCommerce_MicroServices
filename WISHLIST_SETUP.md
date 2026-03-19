# Medusa Wishlist – Step-by-Step Setup Guide

This guide covers adding the **@rsc-labs/medusa-wishlist** plugin to both the Medusa backend and the Next.js storefront so that “Favorite Items” use the backend wishlist API when the customer is logged in.

---

## Part 1: Backend (Medusa)

### Step 1.1: Install the wishlist plugin

From the **backend** project root (`demo-grocery-store`):

```bash
cd demo-grocery-store
npm install @rsc-labs/medusa-wishlist --save --legacy-peer-deps
```

- **Why `--legacy-peer-deps`?** The plugin may declare a peer dependency on an older `@medusajs/admin-sdk`; your app uses a newer one. `--legacy-peer-deps` allows the install to succeed. The plugin still works with the current Medusa version.

### Step 1.2: Register the plugin in config

The plugin is already registered in `demo-grocery-store/medusa-config.ts`:

```ts
plugins: [
  {
    resolve: "@rsc-labs/medusa-wishlist",
    options: {
      jwtSecret: process.env.JWT_SECRET || "supersecret",
    },
  },
],
```

- **JWT secret:** Used for shareable wishlist links. Set `JWT_SECRET` in `.env` in production (you can reuse the same secret as `http.jwtSecret` if desired).

### Step 1.3: Run database migrations

Create the wishlist tables in your database:

```bash
cd demo-grocery-store
npx medusa db:migrate
```

- Ensure your database is running and `DATABASE_URL` in `.env` is correct.
- After this, the backend exposes the wishlist store API (see below).

### Step 1.4: Restart the backend

```bash
cd demo-grocery-store
npm run dev
```

Backend wishlist endpoints:

- **GET** `/store/customers/me/wishlist` – get current customer’s wishlist (requires customer auth).
- **POST** `/store/customers/me/wishlist/items` – add/update item (body: `productId`, `productVariantId`, `quantity`).
- **DELETE** `/store/customers/me/wishlist/items?productId=...&productVariantId=...` – remove item.
- **POST** `/store/customers/me/wishlist/share-token` – create share token (optional).
- **GET** `/store/wishlists?token=...` – public view of shared wishlist (optional).

---

## Part 2: Storefront (Next.js)

### Step 2.1: No extra install

The storefront uses the backend’s REST API. No new npm packages are required for the wishlist.

### Step 2.2: What’s already implemented

1. **`src/lib/data/wishlist.ts`** (server-only):
   - `getWishlist()` – GET customer wishlist (uses auth cookie).
   - `addToWishlist(productId, productVariantId, quantity)` – add/update item.
   - `removeFromWishlist(productId, productVariantId)` – remove item.

2. **Home page** (`src/app/[countryCode]/(main)/page.tsx`):
   - Fetches `getWishlist()` when loading the page.
   - Maps wishlist items to `PastPurchaseItem` and passes them as `initialWishlistItems` to the hero/badges.

3. **Hero / HomeBadges** (`src/modules/home/components/hero/index.tsx`, `src/modules/home/components/home-badges/index.tsx`):
   - When the customer is **logged in**: “Favorite Items” uses `initialWishlistItems` from the API; add/remove call the wishlist server actions and then `router.refresh()` so the list updates from the server.
   - When the customer is **not logged in**: “Favorite Items” still uses **localStorage** (unchanged), so guests can mark favorites in the browser only.

### Step 2.3: Ensure backend URL

Storefront calls the backend with `MEDUSA_BACKEND_URL` or `http://localhost:9000`. In `.env` or `.env.local` for the storefront:

```bash
MEDUSA_BACKEND_URL=http://localhost:9000
```

Change the URL if your backend runs on a different host/port.

### Step 2.4: Run the storefront

```bash
cd demo-grocery-store-storefront
npm run dev
```

- Log in as a **customer** (store auth).
- On the home page, “Favorite Items” (and adding/removing from past purchases or favorites) will use the backend wishlist when the customer is logged in.

---

## Quick command summary

| Step | Where | Command |
|------|--------|--------|
| Install plugin | `demo-grocery-store` | `npm install @rsc-labs/medusa-wishlist --save --legacy-peer-deps` |
| Migrate DB | `demo-grocery-store` | `npx medusa db:migrate` |
| Start backend | `demo-grocery-store` | `npm run dev` |
| Start storefront | `demo-grocery-store-storefront` | `npm run dev` |

---

## Optional: Shareable wishlist links

The plugin supports JWT-based share links:

1. **Generate token (customer):**  
   `POST /store/customers/me/wishlist/share-token` with customer auth.  
   Response: `{ "shared_token": "eyJ..." }`.

2. **View shared wishlist (public):**  
   `GET /store/wishlists?token=<shared_token>` (no auth).

You can add a “Share wishlist” button on the storefront that calls the share-token endpoint and copies the link (e.g. `https://your-store.com/wishlist?token=...`) for the user.

---

## Troubleshooting

- **403 / Unauthorized on wishlist endpoints**  
  Customer must be logged in (store JWT in cookie `_medusa_jwt`). Ensure login works and the cookie is sent with requests.

- **Plugin peer dependency conflict**  
  Use `npm install @rsc-labs/medusa-wishlist --save --legacy-peer-deps` as in Step 1.1.

- **Wishlist empty after login**  
  Backend may not return expanded product/variant; titles/thumbnails can be empty until the plugin or your API returns them. Add/remove and refresh should still work.

- **Migrations fail**  
  Check `DATABASE_URL`, DB is running, and you have write access. Run `npx medusa db:migrate` from the backend directory.
