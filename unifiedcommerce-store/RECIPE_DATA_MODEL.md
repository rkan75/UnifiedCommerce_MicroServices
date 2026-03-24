# Recipe Data Model for Grocery Retailer

This document describes the data model for storing, updating, and deleting recipes, with product (variant) association and support for adding recipe ingredients to the cart from the recipe page.

---

## 1. Entity Overview

| Entity | Purpose |
|--------|---------|
| **Recipe** | Master recipe (title, description, image, servings, timings, status). |
| **RecipeStep** | Ordered instructions (step number + text). |
| **RecipeIngredient** | Link recipe to product variants with quantity/unit for display and add-to-cart. |

---

## 2. Entity Definitions

### 2.1 Recipe

Stores the recipe itself. Supports create, read, update, delete.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (PK) | yes | Unique ID (e.g. prefix `recipe_`). |
| `title` | string | yes | Recipe name. |
| `description` | string | no | Short description or intro. |
| `image_url` | string | no | Main recipe image. |
| `servings` | number | no | Default number of servings (for scaling). |
| `prep_time_minutes` | number | no | Prep time in minutes. |
| `cook_time_minutes` | number | no | Cook time in minutes. |
| `status` | string | yes | `draft` \| `published` – controls visibility. |
| `metadata` | JSON | no | Extra attributes (e.g. cuisine, difficulty). |
| `created_at` | timestamp | yes | Set on create. |
| `updated_at` | timestamp | yes | Set on create/update. |
| `deleted_at` | timestamp | no | Soft delete. |

**Features supported:** Store, update, delete (soft delete), list/filter by status.

---

### 2.2 RecipeStep

Ordered instructions for one recipe.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (PK) | yes | Unique ID. |
| `recipe_id` | string (FK) | yes | References `Recipe.id`. |
| `step_number` | number | yes | Order of the step (1, 2, 3…). |
| `instruction` | string | yes | Step text. |
| `created_at` | timestamp | yes | Set on create. |
| `updated_at` | timestamp | yes | Set on create/update. |

**Features supported:** Store/update/delete steps per recipe; display ordered instructions on recipe page.

---

### 2.3 RecipeIngredient

Links a recipe to a **product variant** with quantity and optional unit. This is the **product association** and the source for **add-to-cart**.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (PK) | yes | Unique ID. |
| `recipe_id` | string (FK) | yes | References `Recipe.id`. |
| `product_variant_id` | string | yes | Medusa Product Variant ID (cart uses `variant_id`). |
| `quantity` | number | yes | Amount (e.g. 2). Used for add-to-cart. |
| `unit` | string | no | Display unit (e.g. "cups", "tbsp", "pieces"). |
| `label` | string | no | Display line (e.g. "2 cups flour, sifted"). |
| `display_order` | number | yes | Order of ingredient in list (1, 2, 3…). |
| `created_at` | timestamp | yes | Set on create. |
| `updated_at` | timestamp | yes | Set on create/update. |

**Why `product_variant_id`?**

- Medusa cart line items are created with `variant_id` and `quantity`.
- Storing `product_variant_id` and `quantity` in `RecipeIngredient` allows “Add all ingredients to cart” by building cart items `{ variant_id, quantity }` from each ingredient.
- Optional `unit` and `label` support display on the recipe page without changing cart behavior.

**Features supported:** Product (variant) association; ordered ingredient list; add single ingredient or all ingredients to cart using variant IDs and quantities.

---

## 3. Relationships

```
Recipe 1 ──────< RecipeStep   (one recipe, many steps)
Recipe 1 ──────< RecipeIngredient   (one recipe, many ingredients)
RecipeIngredient ── product_variant_id ──> Product Module (variant)   (logical reference only)
```

- **Recipe → RecipeStep:** One-to-many, delete steps when recipe is deleted (or soft-delete with recipe).
- **Recipe → RecipeIngredient:** One-to-many, delete ingredients when recipe is deleted (or soft-delete with recipe).
- **RecipeIngredient → Product Variant:** Reference by ID only (no DB FK); used for display and cart.

---

## 4. Feature Mapping

| Feature | How the data model supports it |
|---------|--------------------------------|
| **Store recipe** | Insert `Recipe`; then insert `RecipeStep` and `RecipeIngredient` rows. |
| **Update recipe** | Update `Recipe`; add/update/delete `RecipeStep` and `RecipeIngredient` as needed. |
| **Delete recipe** | Soft delete `Recipe` (set `deleted_at`); optionally soft-delete or hard-delete steps/ingredients. |
| **Show recipe** | Load `Recipe` by id (respecting `deleted_at`, optionally `status = published`); load steps ordered by `step_number`; load ingredients ordered by `display_order`. |
| **Product association** | `RecipeIngredient.product_variant_id` (+ optional product/variant fetch from Product module for labels, images). |
| **Add from recipe to cart** | For “Add all”: for each `RecipeIngredient`, call cart API with `variant_id = product_variant_id`, `quantity = quantity`. For “Add one”: same with a single ingredient. |

---

## 5. Add-to-Cart Payload (Storefront)

From the recipe page, the frontend can:

1. **Add one ingredient:**  
   `POST /store/carts/:id/line-items` with `{ variant_id: ingredient.product_variant_id, quantity: ingredient.quantity }`.

2. **Add all ingredients:**  
   For each `RecipeIngredient`: same body. Optionally merge same `variant_id` and sum `quantity` before sending to avoid duplicate line items.

Servings scaling (e.g. “Scale to 8 servings”) can be done in the UI: multiply each `quantity` by `(desired_servings / recipe.servings)` before calling the cart API.

---

## 6. Optional Extensions

- **Recipe categories/tags:** Add a `RecipeCategory` (or tag) entity and a join table, or store category ids in `Recipe.metadata`.
- **Multiple images:** Store array of URLs in `Recipe.metadata` or add a `RecipeImage` entity.
- **Nutrition:** Add fields to `Recipe` or `RecipeIngredient`, or store in `metadata`.

---

## 7. Implementation Location

- **Models and module:** `src/modules/recipe/` (Recipe, RecipeStep, RecipeIngredient).
- **API:** Admin APIs for CRUD on recipes/steps/ingredients; store API for listing published recipes and returning recipe detail (with variant IDs and quantities) for the recipe page and add-to-cart.

---

## 8. SQL script (standalone)

A raw PostgreSQL script is available if you want to create the tables without Medusa migrations:

- **File:** `src/modules/recipe/recipe-schema.sql`

Run with:

```bash
psql "$DATABASE_URL" -f src/modules/recipe/recipe-schema.sql
```

Or from any PostgreSQL client. The script creates `recipe`, `recipe_step`, and `recipe_ingredient` with indexes and foreign keys.

**Seed data:** To seed sample recipes, steps, and ingredients (using existing product variants when available):

```bash
npx medusa exec ./src/scripts/seed-recipe.ts
```

---

## 9. Recipe Module Registration

1. **Add to `medusa-config.ts`** (in the `modules` array):

```ts
{
  resolve: "./src/modules/recipe",
  key: "recipe",
  options: {},
}
```

2. **Generate and run migrations** (from project root):

```bash
npx medusa db:generate recipe
npx medusa db:migrate
```

3. **Resolve the service in API routes:** `req.scope.resolve("recipe")` (or the key you used). The service exposes:
   - `createRecipes`, `listRecipes`, `updateRecipes`, `deleteRecipes`, `retrieveRecipe`
   - `createRecipeSteps`, `listRecipeSteps`, `updateRecipeSteps`, `deleteRecipeSteps`, etc.
   - `createRecipeIngredients`, `listRecipeIngredients`, `updateRecipeIngredients`, `deleteRecipeIngredients`, etc.
