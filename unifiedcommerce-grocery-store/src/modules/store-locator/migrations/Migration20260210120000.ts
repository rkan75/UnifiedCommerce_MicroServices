import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260210120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "store_location" (
        "id" text not null,
        "name" text not null,
        "address_1" text not null,
        "city" text null,
        "state" text null,
        "zip" text null,
        "country_code" text null,
        "lat" real null,
        "lng" real null,
        "opening_hours" text null,
        "phone" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "store_location_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_store_location_deleted_at" ON "store_location" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "store_location" cascade;`)
  }
}
