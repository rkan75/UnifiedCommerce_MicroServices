-- Medusa v2 stores selectable countries in `region_country` (not the legacy `country` table).
-- If `us` is missing, Admin fails with: Countries with codes: "us" do not exist
--
-- Run against the same Postgres DB as Medusa (DATABASE_URL), then retry adding US to a region.
-- Prefer: npx medusa exec ./src/scripts/seed-region-countries.ts

INSERT INTO region_country (iso_2, iso_3, num_code, name, display_name, region_id)
VALUES (
  'us',
  'usa',
  '840',
  'UNITED STATES',
  'United States',
  NULL
)
ON CONFLICT (iso_2) DO NOTHING;
