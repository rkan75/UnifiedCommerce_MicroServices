-- Link United States country ↔ United States region (Medusa / catalog DB)
-- Run against the same PostgreSQL database products-service uses for the catalog.
--
-- Use ONE of the strategies below after reviewing the preview queries.
-- Medusa v2 typically uses `country.region_id`. Older setups may rely on `region_country` only.
--
-- Suggested: run the SELECTs first (no writes). For UPDATE/INSERT, wrap in:
--   BEGIN;
--   ... your chosen strategy ...
--   COMMIT;

-- ---------------------------------------------------------------------------
-- 1) Preview: find the US region and US country rows
-- ---------------------------------------------------------------------------
SELECT id, name, currency_code
FROM region
WHERE deleted_at IS NULL
  AND (
    lower(trim(name::text)) IN ('united states', 'usa')
    OR lower(name::text) LIKE '%united states%'
  );

SELECT id,
       iso_2,
       name,
       display_name,
       region_id AS current_region_id
FROM country
WHERE deleted_at IS NULL
  AND lower(trim(iso_2::text)) = 'us';

-- Optional: see existing junction rows for US country
-- SELECT * FROM region_country rc
-- JOIN country c ON c.id::text = rc.country_id::text
-- WHERE lower(trim(c.iso_2::text)) = 'us';

-- ---------------------------------------------------------------------------
-- 2) Strategy A — Medusa v2: set `country.region_id` to the US region
--    (matches AdminRegionService linkCountriesViaCountryRegionId)
-- ---------------------------------------------------------------------------
-- Uncomment to execute:

/*
WITH us_region AS (
  SELECT id
  FROM region
  WHERE deleted_at IS NULL
    AND lower(trim(name::text)) = 'united states'
  ORDER BY id
  LIMIT 1
)
UPDATE country c
SET region_id = (SELECT id FROM us_region),
    updated_at = NOW()
WHERE c.deleted_at IS NULL
  AND lower(trim(c.iso_2::text)) = 'us'
  AND EXISTS (SELECT 1 FROM us_region)
  AND (c.region_id IS DISTINCT FROM (SELECT id FROM us_region));
*/

-- If your region is named slightly differently, replace the filter in us_region, e.g.:
--   AND lower(trim(name::text)) IN ('united states', 'usa')

-- ---------------------------------------------------------------------------
-- 3) Strategy B — Junction table `region_country` (if you use it and want
--    an explicit link; some schemas keep both — avoid double-linking blindly)
-- ---------------------------------------------------------------------------
-- Adjust column names if your table uses camelCase (regionId, countryId).
-- Uncomment to execute:

/*
INSERT INTO region_country (id, region_id, country_id, created_at, updated_at)
SELECT
  'rnc_' || replace(gen_random_uuid()::text, '-', ''),
  r.id,
  c.id,
  NOW(),
  NOW()
FROM region r
CROSS JOIN country c
WHERE r.deleted_at IS NULL
  AND lower(trim(r.name::text)) = 'united states'
  AND c.deleted_at IS NULL
  AND lower(trim(c.iso_2::text)) = 'us'
  AND NOT EXISTS (
    SELECT 1
    FROM region_country rc
    WHERE rc.region_id::text = r.id::text
      AND rc.country_id::text = c.id::text
  );
*/

-- If `region_country` has no `id` column, drop it from the INSERT list.

-- ---------------------------------------------------------------------------
-- 4) Verify
-- ---------------------------------------------------------------------------
-- SELECT id, iso_2, display_name, region_id FROM country WHERE lower(trim(iso_2::text)) = 'us';
-- SELECT * FROM region_country rc JOIN country c ON c.id::text = rc.country_id::text
--   WHERE lower(trim(c.iso_2::text)) = 'us';

-- Tip: while testing, use ROLLBACK instead of COMMIT to undo.
