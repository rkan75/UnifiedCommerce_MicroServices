-- Recipe data model - PostgreSQL
-- Run this script to create tables manually (e.g. psql -f recipe-schema.sql)
-- If you use Medusa migrations, prefer: npx medusa db:generate recipe && npx medusa db:migrate

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. recipe
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "recipe" (
  "id"                TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "description"       TEXT NULL,
  "image_url"         TEXT NULL,
  "servings"          INTEGER NULL,
  "prep_time_minutes" INTEGER NULL,
  "cook_time_minutes" INTEGER NULL,
  "status"            TEXT NOT NULL,
  "metadata"          JSONB NULL,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"        TIMESTAMPTZ NULL,
  CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IDX_recipe_deleted_at"
  ON "recipe" ("deleted_at") WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_recipe_status"
  ON "recipe" ("status") WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. recipe_step
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "recipe_step" (
  "id"           TEXT NOT NULL,
  "recipe_id"    TEXT NOT NULL,
  "step_number"  INTEGER NOT NULL,
  "instruction"  TEXT NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"   TIMESTAMPTZ NULL,
  CONSTRAINT "recipe_step_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_step_recipe_id_foreign"
    FOREIGN KEY ("recipe_id") REFERENCES "recipe" ("id") ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_recipe_step_recipe_id"
  ON "recipe_step" ("recipe_id") WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recipe_step_recipe_id_step_number_unique"
  ON "recipe_step" ("recipe_id", "step_number") WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_recipe_step_deleted_at"
  ON "recipe_step" ("deleted_at") WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. recipe_ingredient
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "recipe_ingredient" (
  "id"                  TEXT NOT NULL,
  "recipe_id"           TEXT NOT NULL,
  "product_variant_id"  TEXT NOT NULL,
  "quantity"            NUMERIC(12, 4) NOT NULL,
  "unit"                TEXT NULL,
  "label"               TEXT NULL,
  "display_order"       INTEGER NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"          TIMESTAMPTZ NULL,
  CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_ingredient_recipe_id_foreign"
    FOREIGN KEY ("recipe_id") REFERENCES "recipe" ("id") ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredient_recipe_id"
  ON "recipe_ingredient" ("recipe_id") WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredient_recipe_id_product_variant_id"
  ON "recipe_ingredient" ("recipe_id", "product_variant_id") WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredient_deleted_at"
  ON "recipe_ingredient" ("deleted_at") WHERE deleted_at IS NULL;

COMMIT;
