import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260209215419 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "recipe_step" drop constraint if exists "recipe_step_recipe_id_step_number_unique";`);
    this.addSql(`create table if not exists "recipe" ("id" text not null, "title" text not null, "description" text null, "image_url" text null, "servings" integer null, "prep_time_minutes" integer null, "cook_time_minutes" integer null, "status" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "recipe_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_deleted_at" ON "recipe" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_status" ON "recipe" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "recipe_ingredient" ("id" text not null, "recipe_id" text not null, "product_variant_id" text not null, "quantity" integer not null, "unit" text null, "label" text null, "display_order" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "recipe_ingredient_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredient_recipe_id" ON "recipe_ingredient" ("recipe_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredient_deleted_at" ON "recipe_ingredient" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredient_recipe_id_product_variant_id" ON "recipe_ingredient" ("recipe_id", "product_variant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "recipe_step" ("id" text not null, "recipe_id" text not null, "step_number" integer not null, "instruction" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "recipe_step_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_step_recipe_id" ON "recipe_step" ("recipe_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recipe_step_deleted_at" ON "recipe_step" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recipe_step_recipe_id_step_number_unique" ON "recipe_step" ("recipe_id", "step_number") WHERE deleted_at IS NULL;`);

    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_ingredient_recipe_id_foreign') THEN
          ALTER TABLE recipe_ingredient ADD CONSTRAINT recipe_ingredient_recipe_id_foreign
          FOREIGN KEY (recipe_id) REFERENCES recipe(id) ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_step_recipe_id_foreign') THEN
          ALTER TABLE recipe_step ADD CONSTRAINT recipe_step_recipe_id_foreign
          FOREIGN KEY (recipe_id) REFERENCES recipe(id) ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "recipe_ingredient" drop constraint if exists "recipe_ingredient_recipe_id_foreign";`);

    this.addSql(`alter table if exists "recipe_step" drop constraint if exists "recipe_step_recipe_id_foreign";`);

    this.addSql(`drop table if exists "recipe" cascade;`);

    this.addSql(`drop table if exists "recipe_ingredient" cascade;`);

    this.addSql(`drop table if exists "recipe_step" cascade;`);
  }

}
