# Custom CLI Script

A custom CLI script is a function to execute through Medusa's CLI tool. This is useful when creating custom Medusa tooling to run as a CLI tool.

> Learn more about custom CLI scripts in [this documentation](https://docs.medusajs.com/learn/fundamentals/custom-cli-scripts).

## How to Create a Custom CLI Script?

To create a custom CLI script, create a TypeScript or JavaScript file under the `src/scripts` directory. The file must default export a function.

For example, create the file `src/scripts/my-script.ts` with the following content:

```ts title="src/scripts/my-script.ts"
import { 
  ExecArgs,
} from "@medusajs/framework/types"

export default async function myScript ({
  container
}: ExecArgs) {
  const productModuleService = container.resolve("product")

  const [, count] = await productModuleService.listAndCountProducts()

  console.log(`You have ${count} product(s)`)
}
```

The function receives as a parameter an object having a `container` property, which is an instance of the Medusa Container. Use it to resolve resources in your Medusa application.

---

## How to Run Custom CLI Script?

To run the custom CLI script, run the `exec` command:

```bash
npx medusa exec ./src/scripts/my-script.ts
```

---

## Custom CLI Script Arguments

Your script can accept arguments from the command line. Arguments are passed to the function's object parameter in the `args` property.

For example:

```ts
import { ExecArgs } from "@medusajs/framework/types"

export default async function myScript ({
  args
}: ExecArgs) {
  console.log(`The arguments you passed: ${args}`)
}
```

Then, pass the arguments in the `exec` command after the file path:

```bash
npx medusa exec ./src/scripts/my-script.ts arg1 arg2
```

---

## Export products and images to Excel

To export product title, SKU, and all image URLs to an Excel file:

```bash
npx medusa exec ./src/scripts/export-products-excel.ts
```

Output: `data/products-images-export.xlsx` (columns: Product, SKU, Thumbnail URL, Image URL 1, Image URL 2, …).

## Upload products-for-algolia.json to Algolia

If you have `data/products-for-algolia.json` and want to push it to the Algolia **products** index (no database required):

```bash
# From demo-grocery-store/
ALGOLIA_APP_ID=your_app_id ALGOLIA_ADMIN_API_KEY=your_admin_key npx ts-node src/scripts/upload-products-json-to-algolia.ts
```

Or from repo root: `./deploy/run-upload-products-json-to-algolia.sh` (after `export ALGOLIA_APP_ID` and `export ALGOLIA_ADMIN_API_KEY`). Optional: `JSON_FILE=data/other.json`, `ALGOLIA_INDEX_NAME=products`.

## Fill image URLs from product name (Excel)

Reads `data/products-images-export_1.xlsx` and fills the image URL columns using the product name (column A):

1. **Produce** and **Snacks** products use the curated mappings in `produce-images.ts` and `snacks-images.ts`.
2. Other products: set `UNSPLASH_ACCESS_KEY` (free at [unsplash.com/developers](https://unsplash.com/developers)) and run again; the script will search Unsplash for grocery/food-style images by product name.

Kroger/Target scraping is not used (terms of service). Images are from Unsplash and the existing produce/snacks mappings.

```bash
# From demo-grocery-store/
npx ts-node src/scripts/fill-product-images-from-excel.ts

# With Unsplash (for non–Produce/Snacks):
UNSPLASH_ACCESS_KEY=your_key npx ts-node src/scripts/fill-product-images-from-excel.ts
```

Output: `data/products-images-export-filled.xlsx`.

## Scrape product images and prices from Kroger or Target (browser automation)

**Disclaimer:** Automated scraping may violate Kroger’s and Target’s Terms of Service and robots.txt. Use at your own risk and only for personal/educational use. Prefer official APIs or licensed data for production.

The script uses Playwright to open the retailer’s search page for each product name and extract image URLs from the results.

**Setup:**
```bash
npm install playwright
npx playwright install chromium
```

**Usage (from `demo-grocery-store/`):**
```bash
# Target, first 10 products (test run)
npx ts-node src/scripts/scrape-product-images-kroger-target.ts --site=target --limit=10

# Kroger, all products from your Excel
npx ts-node src/scripts/scrape-product-images-kroger-target.ts --site=kroger

# Custom input/output, show browser window
npx ts-node src/scripts/scrape-product-images-kroger-target.ts --site=target --input=data/products-images-export_1.xlsx --output=data/products-images-scraped.xlsx --headed
```

| Option | Description |
|--------|-------------|
| `--site=target` or `--site=kroger` | Retailer to scrape |
| `--limit=N` | Only process first N unique product names (for testing) |
| `--input=path` | Input Excel (default: `data/products-images-export_1.xlsx`) |
| `--output=path` | Output Excel (default: `data/products-images-scraped.xlsx`) |
| `--headed` | Show browser window (default is headless) |

Input Excel must have a **Product** column (column A). Output adds/overwrites **Thumbnail URL**, **Image URL 1**, **Image URL 2**, **Image URL 3**, and **Price** columns. The price is extracted from the first search result and formatted as `$X.XX`. There is a 3-second delay between searches to reduce load on the site. If the browser fails to launch (e.g. in a restricted environment), run the script locally in a normal terminal.

---

## Update product images from Excel (e.g. scraped file)

Uploads all images from `products-images-scraped.xlsx` to the database (product and product variant image tables only). Price columns in the file are **ignored**. Matches rows by **Product** (column A) and applies **Thumbnail URL**, **Image URL 1–5** to product and variant images.

**From backend directory:**
```bash
npx medusa exec ./src/scripts/update-product-images-from-excel.ts
```

**Against Cloud SQL** (with proxy and `DATABASE_URL` set):
```bash
./deploy/run-update-product-images-from-excel.sh
```

Optional: `EXCEL_FILE=data/other.xlsx` to use a different file.

## Update product prices from product_price_list.xlsx

Reads `data/product_price_list.xlsx` (columns **Product**, **Price** or **Price_Numeric**) and updates variant prices in the database by matching product title. Uses the first region’s currency (e.g. USD). Run from backend directory:

```bash
npx medusa exec ./src/scripts/update-product-prices-from-excel.ts
```

Optional: `EXCEL_FILE=data/other.xlsx` to use a different file.

---

## Seed recipe data (Cloud SQL)

To populate the **recipe**, **recipe_step**, and **recipe_ingredient** tables (e.g. in Cloud SQL):

1. Ensure recipe tables exist (run Medusa migrations first if needed).
2. Start Cloud SQL Proxy, then from the **project root** (not demo-grocery-store):
   ```bash
   export DATABASE_URL="postgresql://medusa_app:YOUR_PASSWORD@127.0.0.1:5433/medusa_grocery_store"
   ./deploy/run-recipe-seed.sh
   ```
   This runs `npx medusa exec ./src/scripts/seed-recipe.ts` and creates 6 sample recipes with steps and ingredients (using existing product variants when available).

---

## Create admin user (store backend)

To create an admin user (email + password) for the backend and assign the **Super Admin** role (if RBAC is on):

```bash
npx medusa exec ./src/scripts/create-admin-user.ts -- admin@yourstore.com yourpassword
```

To avoid putting the password in shell history, use env vars:

```bash
ADMIN_EMAIL=admin@yourstore.com ADMIN_PASSWORD=yourpassword npx medusa exec ./src/scripts/create-admin-user.ts
```

Then log in at your admin URL (e.g. `http://localhost:9000/app`). If RBAC is enabled, ensure you have run `seed-rbac-roles.ts` and `seed-super-admin-policies.ts` so the Super Admin role exists and has full permissions.

**If you cannot log in** after creating a user (e.g. "Invalid email or password"), the password may have been mangled by the shell. Reset it with:

```bash
npx medusa exec ./src/scripts/reset-admin-password.ts -- kannan.ramakrishnan@tcs.com YourNewPassword123
```

Or: `ADMIN_EMAIL=... ADMIN_PASSWORD=... npx medusa exec ./src/scripts/reset-admin-password.ts`

**Alternative:** You can also use the Medusa CLI: `npx medusa user -e admin@example.com -p yourpassword` (creates user but does not assign a role; assign the role later in Settings → User & Role Management).

---

## Delete all storefront customers

To **completely remove all storefront customers** (e.g. for a fresh demo or testing):

```bash
# Dry run: shows how many customers would be deleted
npx medusa exec ./src/scripts/delete-all-storefront-customers.ts

# Actually delete all (requires confirmation env)
CONFIRM_DELETE_ALL_CUSTOMERS=yes npx medusa exec ./src/scripts/delete-all-storefront-customers.ts
```

For each customer the script: soft-deletes the customer record and unlinks their auth identity (emailpass), so they no longer appear in the storefront and cannot log in.

---

## Seed RBAC roles (User & Role Management)

To populate predefined roles for the **User & Role Management** admin screen (Settings → User & Role Management), enable RBAC and run the seed script:

1. Set `MEDUSA_FF_RBAC=true` in your `.env`.
2. Run: `npx medusa exec ./src/scripts/seed-rbac-roles.ts`

This creates roles such as Super Admin, Admin, Order Manager, Product Manager, etc., which you can then assign to users in the admin UI.

**If you see "Insufficient permissions" when updating variant prices (or other admin actions) even as Super Admin**, the role may have no policies attached. Run:

```bash
npx medusa exec ./src/scripts/seed-super-admin-policies.ts
```

This attaches all registered policies (e.g. product_variant update/delete) to the "Super Admin" role. Then try saving variant prices again.