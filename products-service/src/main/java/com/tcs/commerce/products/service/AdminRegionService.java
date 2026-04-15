package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.LinkedHashSet;
import java.util.UUID;

/**
 * Admin regions: list and create rows in the Medusa {@code region} table (and optional {@code region_country} links).
 */
@Service
public class AdminRegionService {

    private static final Logger log = LoggerFactory.getLogger(AdminRegionService.class);

    /**
     * When {@code country.region_id} / junction rows are missing and exact name match fails (e.g. region "United States"
     * but country row uses a different label), resolve display via ISO-3166 alpha-2.
     */
    private static final Map<String, String> REGION_DISPLAY_TO_ISO2 = new HashMap<>();

    static {
        REGION_DISPLAY_TO_ISO2.put("united states", "us");
        REGION_DISPLAY_TO_ISO2.put("united states of america", "us");
        REGION_DISPLAY_TO_ISO2.put("usa", "us");
        REGION_DISPLAY_TO_ISO2.put("u.s.", "us");
        REGION_DISPLAY_TO_ISO2.put("u.s.a.", "us");
        REGION_DISPLAY_TO_ISO2.put("united kingdom", "gb");
        REGION_DISPLAY_TO_ISO2.put("great britain", "gb");
        REGION_DISPLAY_TO_ISO2.put("uk", "gb");
    }

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final CatalogSchemaCache schema;
    private final ObjectMapper objectMapper;

    public AdminRegionService(JdbcTemplate jdbc, ProductsProperties props, CatalogSchemaCache schema, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.props = props;
        this.schema = schema;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> listRegionsAdminResponse() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("regions", mergeStoreDefaultRegionIfMissing(listRegionRowsRobust()));
        out.put("country_options", listCountryOptions());
        return out;
    }

    /**
     * Paginated ISO country catalog for the admin UI — same physical data Medusa Admin uses.
     * <p>
     * Medusa v2 Region module maps the Country model to table {@code region_country} (PK {@code iso_2},
     * nullable {@code region_id}); there is no separate {@code country} table in the default migration
     * ({@code Migration20240205173216} in {@code @medusajs/region}). Override {@code CATALOG_COUNTRY_TABLE} if you use a
     * legacy schema with {@code country}.
     */
    public Map<String, Object> listCountryCatalog(String q, int limit, int offset) {
        Map<String, Object> out = new LinkedHashMap<>();
        int lim = Math.max(1, Math.min(limit, 100));
        int off = Math.max(0, offset);
        out.put("limit", lim);
        out.put("offset", off);
        out.put("countries", List.of());
        out.put("count", 0);
        String cTable = countryTableName();
        if (!schema.hasTable(cTable)) {
            log.warn("[admin-regions] country_catalog: table \"{}\" missing", cTable);
            return out;
        }
        String isoCol = resolveCountryIsoColumn(cTable);
        if (isoCol == null) {
            return out;
        }
        String labelExpr;
        if (schema.hasColumn(cTable, "display_name")) {
            labelExpr =
                "COALESCE(NULLIF(trim(display_name::text), ''), NULLIF(trim(name::text), ''), " + isoCol + "::text)";
        } else if (schema.hasColumn(cTable, "name")) {
            labelExpr = "COALESCE(NULLIF(trim(name::text), ''), " + isoCol + "::text)";
        } else {
            labelExpr = isoCol + "::text";
        }
        String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String qt = q != null ? q.trim().toLowerCase(Locale.ROOT) : "";
        String searchSql = "";
        List<Object> searchArgs = new ArrayList<>();
        if (!qt.isEmpty()) {
            String like = "%" + qt + "%";
            searchSql =
                " AND (lower(trim("
                    + isoCol
                    + "::text)) LIKE ? OR lower(trim("
                    + labelExpr
                    + ")) LIKE ?)";
            searchArgs.add(like);
            searchArgs.add(like);
        }
        try {
            Integer total =
                jdbc.queryForObject(
                    "SELECT COUNT(*)::int FROM " + cTable + " WHERE " + alive + searchSql,
                    Integer.class,
                    searchArgs.toArray()
                );
            out.put("count", total != null ? total : 0);

            List<Object> pageArgs = new ArrayList<>(searchArgs);
            pageArgs.add(lim);
            pageArgs.add(off);
            List<Map<String, String>> rows =
                jdbc.query(
                    "SELECT lower(trim("
                        + isoCol
                        + "::text)) AS iso_2, "
                        + labelExpr
                        + " AS display_name FROM "
                        + cTable
                        + " WHERE "
                        + alive
                        + searchSql
                        + " ORDER BY "
                        + labelExpr
                        + " NULLS LAST LIMIT ? OFFSET ?",
                    (rs, i) -> {
                        Map<String, String> m = new LinkedHashMap<>();
                        m.put("iso_2", rs.getString("iso_2"));
                        m.put("display_name", rs.getString("display_name"));
                        return m;
                    },
                    pageArgs.toArray()
                );
            out.put("countries", rows);
        } catch (Exception e) {
            log.warn("[admin-regions] country_catalog: {}", e.getMessage());
        }
        return out;
    }

    /**
     * Ensures the row referenced by {@code store.default_region_id} appears in the admin list even when the bulk
     * list query fails, enrichment throws, or the row was omitted by a schema edge case — matching what Store settings
     * already shows as {@code default_region_name}.
     */
    private List<Map<String, Object>> mergeStoreDefaultRegionIfMissing(List<Map<String, Object>> regions) {
        List<Map<String, Object>> list = regions != null ? new ArrayList<>(regions) : new ArrayList<>();
        String defId = loadStoreDefaultRegionId();
        if (defId == null || defId.isBlank()) {
            return list;
        }
        defId = defId.trim();
        for (Map<String, Object> r : list) {
            if (defId.equals(Objects.toString(r.get("id"), "").trim())) {
                return list;
            }
        }
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            return list;
        }
        Map<String, Object> row = loadRegionRow(rTable, defId);
        if (row != null) {
            try {
                list.add(0, enrichRegionRow(rTable, row));
            } catch (Exception e) {
                log.warn("[admin-regions] enrich default region {}: {}", defId, e.getMessage());
                Map<String, Object> minimal = new LinkedHashMap<>();
                minimal.put("id", defId);
                minimal.put("name", row.get("name"));
                if (schema.hasColumn(rTable, "currency_code")) {
                    Object cc = row.get("currency_code");
                    minimal.put("currency_code", cc != null ? Objects.toString(cc, "").toLowerCase(Locale.ROOT) : null);
                } else {
                    minimal.put("currency_code", null);
                }
                minimal.put("countries", "—");
                minimal.put("payment_providers", "System (DEFAULT)");
                minimal.put("created_at", null);
                minimal.put("updated_at", null);
                list.add(0, minimal);
            }
            return list;
        }
        String name = lookupRegionName(rTable, defId);
        String cur = lookupRegionCurrencyCode(rTable, defId);
        Map<String, Object> syn = new LinkedHashMap<>();
        syn.put("id", defId);
        syn.put("name", name != null ? name : defId);
        syn.put("currency_code", cur);
        syn.put("countries", "—");
        syn.put("payment_providers", "System (DEFAULT)");
        syn.put("created_at", null);
        syn.put("updated_at", null);
        list.add(0, syn);
        return list;
    }

    private String loadStoreDefaultRegionId() {
        String storeT = sanitizeTable(props.getStoreTable());
        if (!schema.hasTable(storeT) || !schema.hasColumn(storeT, "default_region_id")) {
            return null;
        }
        try {
            String alive = schema.hasColumn(storeT, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<String> ids = jdbc.query(
                "SELECT default_region_id::text FROM "
                    + storeT
                    + " WHERE "
                    + alive
                    + " AND default_region_id IS NOT NULL ORDER BY id ASC LIMIT 1",
                (rs, i) -> rs.getString(1)
            );
            if (ids.isEmpty() || ids.get(0) == null || ids.get(0).isBlank()) {
                return null;
            }
            return ids.get(0).trim();
        } catch (Exception e) {
            log.debug("[admin-regions] loadStoreDefaultRegionId: {}", e.getMessage());
            return null;
        }
    }

    private String lookupRegionName(String rTable, String id) {
        if (id == null || id.isBlank() || !schema.hasColumn(rTable, "name")) {
            return null;
        }
        try {
            String alive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<String> names = jdbc.query(
                "SELECT name FROM " + rTable + " WHERE id::text = ? AND " + alive + " LIMIT 1",
                (rs, i) -> rs.getString(1),
                id.trim()
            );
            return names.isEmpty() ? null : names.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private String lookupRegionCurrencyCode(String rTable, String regionId) {
        if (regionId == null || regionId.isBlank() || !schema.hasColumn(rTable, "currency_code")) {
            return null;
        }
        try {
            String alive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<String> codes = jdbc.query(
                "SELECT lower(trim(currency_code::text)) FROM "
                    + rTable
                    + " WHERE id::text = ? AND "
                    + alive
                    + " LIMIT 1",
                (rs, i) -> rs.getString(1),
                regionId.trim()
            );
            return codes.isEmpty() ? null : codes.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Lists regions with fallback SQL and per-row enrichment so one bad row or a fragile SELECT does not empty the table.
     */
    private List<Map<String, Object>> listRegionRowsRobust() {
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            return new ArrayList<>();
        }
        String alive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        boolean hasCur = schema.hasColumn(rTable, "currency_code");
        List<Map<String, Object>> raw;
        try {
            StringBuilder sel = new StringBuilder("SELECT id::text AS id, name");
            if (hasCur) {
                sel.append(", lower(trim(currency_code::text)) AS currency_code");
            }
            if (schema.hasColumn(rTable, "automatic_taxes")) {
                sel.append(", automatic_taxes");
            }
            if (schema.hasColumn(rTable, "includes_tax")) {
                sel.append(", includes_tax");
            } else if (schema.hasColumn(rTable, "is_tax_inclusive")) {
                sel.append(", is_tax_inclusive");
            } else if (schema.hasColumn(rTable, "tax_inclusive_pricing")) {
                sel.append(", tax_inclusive_pricing");
            }
            if (schema.hasColumn(rTable, "metadata")) {
                sel.append(", metadata");
            }
            if (schema.hasColumn(rTable, "created_at")) {
                sel.append(", created_at");
            }
            if (schema.hasColumn(rTable, "updated_at")) {
                sel.append(", updated_at");
            }
            sel.append(" FROM ").append(rTable).append(" WHERE ").append(alive).append(" ORDER BY name NULLS LAST LIMIT 500");
            raw = jdbc.queryForList(sel.toString());
        } catch (Exception e) {
            log.warn("[admin-regions] primary region list failed ({}), using fallback: {}", rTable, e.getMessage());
            try {
                raw = jdbc.queryForList(
                    "SELECT id::text AS id, name FROM " + rTable + " WHERE " + alive + " ORDER BY name NULLS LAST LIMIT 500"
                );
            } catch (Exception e2) {
                log.warn("[admin-regions] fallback region list failed: {}", e2.getMessage());
                return new ArrayList<>();
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : raw) {
            try {
                out.add(enrichRegionRow(rTable, row));
            } catch (Exception e) {
                log.warn("[admin-regions] enrich skipped for row: {}", e.getMessage());
                Map<String, Object> minimal = new LinkedHashMap<>();
                minimal.put("id", Objects.toString(row.get("id"), ""));
                minimal.put("name", row.get("name"));
                minimal.put("currency_code", row.get("currency_code"));
                minimal.put("countries", "—");
                minimal.put("payment_providers", "System (DEFAULT)");
                minimal.put("created_at", null);
                minimal.put("updated_at", null);
                if (!String.valueOf(minimal.get("id")).isBlank()) {
                    out.add(minimal);
                }
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> createRegion(JsonNode body) {
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "JSON body required");
        }
        String name = text(body.get("name"));
        String currencyCode = normalizeCurrency(text(body.get("currency_code")));
        if (name == null || name.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "name is required");
        }
        if (currencyCode == null || currencyCode.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "currency_code is required");
        }
        boolean automaticTaxes = body.has("automatic_taxes") && !body.get("automatic_taxes").isNull()
            ? body.get("automatic_taxes").asBoolean(true)
            : true;
        boolean taxInclusive = body.has("tax_inclusive_pricing") && !body.get("tax_inclusive_pricing").isNull()
            && body.get("tax_inclusive_pricing").asBoolean(false);

        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region table not found in catalog database");
        }

        String id = "reg_" + UUID.randomUUID().toString().replace("-", "");
        Timestamp now = new Timestamp(System.currentTimeMillis());

        List<String> cols = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        cols.add("id");
        vals.add(id);
        if (schema.hasColumn(rTable, "name")) {
            cols.add("name");
            vals.add(name.trim());
        }
        if (schema.hasColumn(rTable, "currency_code")) {
            cols.add("currency_code");
            vals.add(currencyCode);
        }
        if (schema.hasColumn(rTable, "created_at")) {
            cols.add("created_at");
            vals.add(now);
        }
        if (schema.hasColumn(rTable, "updated_at")) {
            cols.add("updated_at");
            vals.add(now);
        }
        if (schema.hasColumn(rTable, "automatic_taxes")) {
            cols.add("automatic_taxes");
            vals.add(automaticTaxes);
        }
        if (schema.hasColumn(rTable, "gift_cards_taxable")) {
            cols.add("gift_cards_taxable");
            vals.add(true);
        }
        if (schema.hasColumn(rTable, "includes_tax")) {
            cols.add("includes_tax");
            vals.add(taxInclusive);
        } else if (schema.hasColumn(rTable, "is_tax_inclusive")) {
            cols.add("is_tax_inclusive");
            vals.add(taxInclusive);
        } else if (schema.hasColumn(rTable, "tax_inclusive_pricing")) {
            cols.add("tax_inclusive_pricing");
            vals.add(taxInclusive);
        }

        boolean needMeta =
            !schema.hasColumn(rTable, "automatic_taxes")
                || (!schema.hasColumn(rTable, "includes_tax")
                    && !schema.hasColumn(rTable, "is_tax_inclusive")
                    && !schema.hasColumn(rTable, "tax_inclusive_pricing"));
        if (needMeta && schema.hasColumn(rTable, "metadata") && schema.columnIsJsonb(rTable, "metadata")) {
            Map<String, Object> metaExtras = new LinkedHashMap<>();
            if (!schema.hasColumn(rTable, "automatic_taxes")) {
                metaExtras.put("automatic_taxes", automaticTaxes);
            }
            if (!schema.hasColumn(rTable, "includes_tax")
                && !schema.hasColumn(rTable, "is_tax_inclusive")
                && !schema.hasColumn(rTable, "tax_inclusive_pricing")) {
                metaExtras.put("tax_inclusive_pricing", taxInclusive);
            }
            if (!metaExtras.isEmpty()) {
                try {
                    PGobject pg = new PGobject();
                    pg.setType("jsonb");
                    pg.setValue(objectMapper.writeValueAsString(metaExtras));
                    cols.add("metadata");
                    vals.add(pg);
                } catch (Exception e) {
                    throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not build metadata: " + e.getMessage());
                }
            }
        }

        String placeholders = String.join(", ", Collections.nCopies(cols.size(), "?"));
        String sqlIns = "INSERT INTO " + rTable + " (" + String.join(", ", cols) + ") VALUES (" + placeholders + ")";
        try {
            jdbc.update(sqlIns, vals.toArray());
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not create region: " + e.getMessage());
        }

        linkCountries(id, body.get("countries"));

        Map<String, Object> row = loadRegionRow(rTable, id);
        if (row == null) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Region created but could not be reloaded");
        }
        return enrichRegionRow(rTable, row);
    }

    private void linkCountries(String regionId, JsonNode countriesNode) {
        if (countriesNode == null || !countriesNode.isArray() || countriesNode.isEmpty()) {
            return;
        }
        String cTable = countryTableName();
        if (!schema.hasTable(cTable)) {
            return;
        }
        String isoCol = resolveCountryIsoColumn(cTable);
        if (isoCol == null) {
            return;
        }
        /** Medusa v2: ISO catalog and region assignment share {@code region_country} (PK {@code iso_2}). */
        if (isMedusaV2RegionCountryCatalogTable()) {
            linkCountriesMedusaV2RegionCountry(regionId, countriesNode, cTable, isoCol);
            return;
        }
        String rcTable = "region_country";
        if (schema.hasTable(rcTable)) {
            String regionCol = resolveRegionCountryRegionColumn(rcTable);
            String countryCol = resolveRegionCountryCountryColumn(rcTable);
            if (regionCol != null && countryCol != null) {
                for (JsonNode n : countriesNode) {
                    if (n == null || n.isNull() || !n.isTextual()) {
                        continue;
                    }
                    String iso = normalizeIso(n.asText());
                    if (iso == null) {
                        continue;
                    }
                    String countryId = findCountryIdByIso(cTable, isoCol, iso);
                    if (countryId == null) {
                        continue;
                    }
                    insertRegionCountryIfMissing(rcTable, regionCol, countryCol, regionId, countryId);
                }
                return;
            }
        }
        if (schema.hasColumn(cTable, "region_id")) {
            linkCountriesViaCountryRegionId(regionId, countriesNode, cTable, isoCol);
        }
    }

    /**
     * Medusa v2 {@code region_country}: one row per ISO code; assign region by updating {@code region_id}.
     */
    private void linkCountriesMedusaV2RegionCountry(
        String regionId,
        JsonNode countriesNode,
        String cTable,
        String isoCol
    ) {
        String rid = regionId != null ? regionId.trim() : "";
        if (rid.isEmpty()) {
            return;
        }
        for (JsonNode n : countriesNode) {
            if (n == null || n.isNull() || !n.isTextual()) {
                continue;
            }
            String iso = normalizeIso(n.asText());
            if (iso == null) {
                continue;
            }
            try {
                StringBuilder sql = new StringBuilder("UPDATE ").append(cTable).append(" SET region_id = ?");
                if (schema.hasColumn(cTable, "updated_at")) {
                    sql.append(", updated_at = NOW()");
                }
                sql.append(" WHERE lower(trim(").append(isoCol).append("::text)) = lower(?)");
                jdbc.update(sql.toString(), rid, iso);
            } catch (Exception e) {
                log.debug("[admin-regions] linkCountriesMedusaV2 UPDATE {}: {}", iso, e.getMessage());
            }
        }
    }

    /** True when {@link ProductsProperties#getCountryTable()} is Medusa v2's {@code region_country} entity. */
    private boolean isMedusaV2RegionCountryCatalogTable() {
        String ct = countryTableName();
        if (!"region_country".equals(ct) || !schema.hasTable(ct)) {
            return false;
        }
        return schema.hasColumn(ct, "iso_2") && schema.hasColumn(ct, "region_id");
    }

    /** Medusa v2: countries reference the region with {@code country.region_id}. */
    private void linkCountriesViaCountryRegionId(String regionId, JsonNode countriesNode, String cTable, String isoCol) {
        String rid = regionId != null ? regionId.trim() : "";
        if (rid.isEmpty()) {
            return;
        }
        for (JsonNode n : countriesNode) {
            if (n == null || n.isNull() || !n.isTextual()) {
                continue;
            }
            String iso = normalizeIso(n.asText());
            if (iso == null) {
                continue;
            }
            String countryId = findCountryIdByIso(cTable, isoCol, iso);
            if (countryId == null) {
                continue;
            }
            try {
                StringBuilder sql = new StringBuilder("UPDATE ").append(cTable).append(" SET region_id = ?");
                if (schema.hasColumn(cTable, "updated_at")) {
                    sql.append(", updated_at = NOW()");
                }
                sql.append(" WHERE id::text = ?");
                jdbc.update(sql.toString(), rid, countryId.trim());
            } catch (Exception e) {
                log.debug("[admin-regions] UPDATE country.region_id: {}", e.getMessage());
            }
        }
    }

    private void insertRegionCountryIfMissing(String rcTable, String regionCol, String countryCol, String regionId, String countryId) {
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM " + rcTable + " WHERE " + regionCol + "::text = ? AND " + countryCol + "::text = ?",
                Integer.class,
                regionId.trim(),
                countryId.trim()
            );
            if (n != null && n > 0) {
                return;
            }
        } catch (Exception e) {
            return;
        }
        List<String> cols = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        if (schema.hasColumn(rcTable, "id")) {
            cols.add("id");
            vals.add("rnc_" + UUID.randomUUID().toString().replace("-", ""));
        }
        cols.add(regionCol);
        vals.add(regionId.trim());
        cols.add(countryCol);
        vals.add(countryId.trim());
        if (schema.hasColumn(rcTable, "created_at")) {
            cols.add("created_at");
            vals.add(new Timestamp(System.currentTimeMillis()));
        }
        if (schema.hasColumn(rcTable, "updated_at")) {
            cols.add("updated_at");
            vals.add(new Timestamp(System.currentTimeMillis()));
        }
        String ph = String.join(", ", Collections.nCopies(cols.size(), "?"));
        try {
            jdbc.update("INSERT INTO " + rcTable + " (" + String.join(", ", cols) + ") VALUES (" + ph + ")", vals.toArray());
        } catch (Exception e) {
            // duplicate or FK
        }
    }

    private String resolveRegionCountryRegionColumn(String rcTable) {
        if (schema.hasColumn(rcTable, "region_id")) {
            return "region_id";
        }
        if (schema.hasColumn(rcTable, "regionId")) {
            return "regionId";
        }
        return null;
    }

    private String resolveRegionCountryCountryColumn(String rcTable) {
        if (schema.hasColumn(rcTable, "country_id")) {
            return "country_id";
        }
        if (schema.hasColumn(rcTable, "countryId")) {
            return "countryId";
        }
        if (schema.hasColumn(rcTable, "country_iso_2")) {
            return "country_iso_2";
        }
        if (schema.hasColumn(rcTable, "iso_2")) {
            return "iso_2";
        }
        return null;
    }

    /** Medusa may use {@code id} or {@code iso_2} as the country primary key. */
    private String resolveCountryPkColumn(String cTable) {
        if (!schema.hasTable(cTable)) {
            return null;
        }
        if (schema.hasColumn(cTable, "id")) {
            return "id";
        }
        if (schema.hasColumn(cTable, "iso_2")) {
            return "iso_2";
        }
        return null;
    }

    private String resolveCountryIsoColumn(String cTable) {
        if (schema.hasColumn(cTable, "iso_2")) {
            return "iso_2";
        }
        if (schema.hasColumn(cTable, "iso2")) {
            return "iso2";
        }
        return null;
    }

    private String findCountryIdByIso(String cTable, String isoCol, String isoLower) {
        String pk = resolveCountryPkColumn(cTable);
        if (pk == null) {
            return null;
        }
        String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            List<String> ids = jdbc.query(
                "SELECT " + pk + "::text FROM " + cTable + " WHERE lower(trim(" + isoCol + "::text)) = lower(?) AND " + alive + " LIMIT 1",
                (rs, i) -> rs.getString(1),
                isoLower
            );
            return ids.isEmpty() ? null : ids.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> loadRegionRow(String rTable, String id) {
        try {
            String alive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM " + rTable + " WHERE id::text = ? AND " + alive + " LIMIT 1",
                id
            );
            return rows.isEmpty() ? null : rows.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> enrichRegionRow(String rTable, Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        String id = Objects.toString(row.get("id"), "");
        m.put("id", id);
        m.put("name", row.get("name"));
        m.put("currency_code", row.get("currency_code"));
        m.put("countries", countriesDisplayForRegion(id));
        m.put("payment_providers", paymentProvidersDisplayForRegion(rTable, id));
        m.put("automatic_taxes", readAutomaticTaxesFromRow(rTable, row));
        m.put("tax_inclusive_pricing", readTaxInclusiveFromRow(rTable, row));
        m.put("created_at", formatTimestampForJson(row.get("created_at")));
        m.put("updated_at", formatTimestampForJson(row.get("updated_at")));
        return m;
    }

    /** ISO-8601 for JSON (admin list filters / sort). */
    private static String formatTimestampForJson(Object v) {
        if (v == null) {
            return null;
        }
        try {
            if (v instanceof Timestamp ts) {
                return ts.toInstant().toString();
            }
            if (v instanceof java.util.Date d) {
                return d.toInstant().toString();
            }
            if (v instanceof Instant ins) {
                return ins.toString();
            }
            return v.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Medusa v2: {@code country.region_id} → region. Legacy: {@code region_country} junction.
     * Uses simple SELECT lists (not {@code string_agg}) and multiple join strategies because PK may be {@code id} or {@code iso_2}.
     */
    private String countriesDisplayForRegion(String regionId) {
        if (regionId == null || regionId.isBlank()) {
            return "—";
        }
        String rid = regionId.trim();
        String cTable = countryTableName();

        String byRegionId = aggregateCountriesByCountryRegionId(rid, cTable);
        if (byRegionId != null) {
            return byRegionId;
        }

        String byJunction = aggregateCountriesByRegionCountryJunction(rid, cTable);
        if (byJunction != null) {
            return byJunction;
        }

        String byDiscovered = aggregateCountriesDiscoveredJunction(rid, cTable);
        if (byDiscovered != null) {
            return byDiscovered;
        }

        // Fallback: match region.name to country.display_name / country.name (when FK/junction rows are missing)
        String byNameMatch = aggregateCountriesByRegionAndCountryNameMatch(rid, cTable);
        if (byNameMatch != null) {
            return byNameMatch;
        }

        // e.g. region named "United States" but country row label is only "US" or differs from region name
        String byIsoHint = aggregateCountriesByRegionIsoHint(rid, cTable);
        if (byIsoHint != null) {
            return byIsoHint;
        }

        String byRcDisplay = aggregateCountriesByRegionCountryDenormalizedMatch(rid);
        if (byRcDisplay != null) {
            return byRcDisplay;
        }

        log.warn(
            "[admin-regions] No countries resolved for region_id={} (tried region_id, junctions, region/country name match).",
            rid
        );
        return "—";
    }

    /**
     * SQL shape similar to:
     * {@code SELECT … FROM region r, country c WHERE r.name} matches {@code c.display_name} or {@code c.name}
     * (and {@code r.id} is the current region). Used when link tables / {@code country.region_id} are not populated.
     */
    private String aggregateCountriesByRegionAndCountryNameMatch(String regionId, String cTable) {
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable) || !schema.hasTable(cTable)) {
            return null;
        }
        List<String> regionNames;
        try {
            String rAlive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            regionNames =
                jdbc.query(
                    "SELECT name::text FROM " + rTable + " WHERE id::text = ? AND " + rAlive + " LIMIT 1",
                    (rs, i) -> rs.getString(1),
                    regionId
                );
        } catch (Exception e) {
            log.debug("[admin-regions] load region name: {}", e.getMessage());
            return null;
        }
        if (regionNames.isEmpty() || regionNames.get(0) == null || regionNames.get(0).isBlank()) {
            return null;
        }
        String rn = regionNames.get(0).trim();
        String label = countryDisplayLabelSql(cTable, "c");
        if (label == null) {
            return null;
        }
        String cAlive = schema.hasColumn(cTable, "deleted_at") ? "c.deleted_at IS NULL" : "TRUE";
        List<String> parts = new ArrayList<>();
        if (schema.hasColumn(cTable, "display_name")) {
            parts.add("lower(trim(c.display_name::text)) = lower(trim(?))");
        }
        if (schema.hasColumn(cTable, "name")) {
            parts.add("lower(trim(c.name::text)) = lower(trim(?))");
        }
        if (parts.isEmpty()) {
            return null;
        }
        String orExpr = String.join(" OR ", parts);
        List<Object> args = new ArrayList<>();
        if (schema.hasColumn(cTable, "display_name")) {
            args.add(rn);
        }
        if (schema.hasColumn(cTable, "name")) {
            args.add(rn);
        }
        try {
            String q =
                "SELECT "
                    + label
                    + " AS lb FROM "
                    + cTable
                    + " c WHERE ("
                    + cAlive
                    + ") AND ("
                    + orExpr
                    + ") ORDER BY "
                    + label;
            List<String> rows = jdbc.query(q, (rs, i) -> rs.getString("lb"), args.toArray());
            return joinCsvDistinct(rows);
        } catch (Exception e) {
            log.debug("[admin-regions] region/country name match: {}", e.getMessage());
            return null;
        }
    }

    private static String inferIso2FromRegionDisplayName(String regionName) {
        if (regionName == null) {
            return null;
        }
        String t = regionName.trim();
        if (t.isEmpty()) {
            return null;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        if (t.length() == 2 && t.codePoints().allMatch(cp -> Character.isLetter(cp))) {
            return lower;
        }
        return REGION_DISPLAY_TO_ISO2.get(lower);
    }

    /**
     * Looks up {@code country} rows by {@code iso_2} when the region display name maps to a known ISO code
     * (covers Medusa seeds where the US row is not linked by FK and labels do not exactly equal the region name).
     */
    private String aggregateCountriesByRegionIsoHint(String regionId, String cTable) {
        if (!schema.hasTable(cTable) || !schema.hasColumn(cTable, "iso_2")) {
            return null;
        }
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            return null;
        }
        String regionName;
        try {
            String rAlive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<String> names =
                jdbc.query(
                    "SELECT name::text FROM " + rTable + " WHERE id::text = ? AND " + rAlive + " LIMIT 1",
                    (rs, i) -> rs.getString(1),
                    regionId.trim()
                );
            if (names.isEmpty() || names.get(0) == null || names.get(0).isBlank()) {
                return null;
            }
            regionName = names.get(0).trim();
        } catch (Exception e) {
            log.debug("[admin-regions] iso hint region name: {}", e.getMessage());
            return null;
        }
        String iso = inferIso2FromRegionDisplayName(regionName);
        if (iso == null || iso.isBlank()) {
            return null;
        }
        String label = countryDisplayLabelSql(cTable, "c");
        if (label == null) {
            return null;
        }
        String cAlive = schema.hasColumn(cTable, "deleted_at") ? "c.deleted_at IS NULL" : "TRUE";
        try {
            String q =
                "SELECT "
                    + label
                    + " AS lb FROM "
                    + cTable
                    + " c WHERE lower(trim(c.iso_2::text)) = lower(trim(?)) AND "
                    + cAlive
                    + " ORDER BY "
                    + label
                    + " LIMIT 16";
            List<String> rows = jdbc.query(q, (rs, i) -> rs.getString("lb"), iso);
            return joinCsvDistinct(rows);
        } catch (Exception e) {
            log.debug("[admin-regions] iso hint query: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Only if {@code region_country} has a {@code display_name} column (denormalized / legacy schemas):
     * {@code region JOIN region_country ON region.name = region_country.display_name}.
     */
    private String aggregateCountriesByRegionCountryDenormalizedMatch(String regionId) {
        String rcTable = "region_country";
        if (!schema.hasTable(rcTable) || !schema.hasColumn(rcTable, "display_name")) {
            return null;
        }
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            return null;
        }
        try {
            String rAlive = schema.hasColumn(rTable, "deleted_at") ? "a.deleted_at IS NULL" : "TRUE";
            String q =
                "SELECT trim(b.display_name::text) AS lb FROM "
                    + rTable
                    + " a INNER JOIN "
                    + rcTable
                    + " b ON lower(trim(a.name::text)) = lower(trim(b.display_name::text)) WHERE a.id::text = ? AND "
                    + rAlive;
            List<String> rows = jdbc.query(q, (rs, i) -> rs.getString("lb"), regionId);
            return joinCsvDistinct(rows);
        } catch (Exception e) {
            log.debug("[admin-regions] region x region_country.display_name: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Finds any public table (other than {@code region}/{@code country}) that has both {@code region_id} and a country
     * reference column — covers renamed Medusa module link tables.
     */
    private String aggregateCountriesDiscoveredJunction(String regionId, String cTable) {
        List<String> candidates;
        try {
            candidates =
                jdbc.query(
                    "SELECT DISTINCT c.table_name FROM information_schema.columns c "
                        + "WHERE c.table_schema = 'public' "
                        + "AND c.table_name IN ("
                        + "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'region_id') "
                        + "AND c.column_name IN ('country_id', 'countryId', 'country_iso_2', 'iso_2') "
                        + "AND c.table_name NOT IN ('region', 'country', 'store', 'cart', 'order', 'customer') "
                        + "ORDER BY 1",
                    (rs, i) -> rs.getString(1)
                );
        } catch (Exception e) {
            log.debug("[admin-regions] discover junction tables: {}", e.getMessage());
            return null;
        }
        for (String tname : candidates) {
            if (tname == null || tname.isBlank()) {
                continue;
            }
            String tl = tname.trim().toLowerCase(Locale.ROOT);
            if (!schema.hasTable(tl)) {
                continue;
            }
            String s = aggregateCountriesByJunctionTable(regionId, cTable, tl);
            if (s != null) {
                log.info("[admin-regions] resolved countries via discovered link table {}", tl);
                return s;
            }
        }
        return null;
    }

    private String aggregateCountriesByCountryRegionId(String regionId, String cTable) {
        if (!schema.hasTable(cTable) || !schema.hasColumn(cTable, "region_id")) {
            return null;
        }
        String label = countryDisplayLabelSql(cTable, "c");
        if (label == null) {
            return null;
        }
        String cAlive = schema.hasColumn(cTable, "deleted_at") ? "c.deleted_at IS NULL" : "TRUE";
        try {
            String q =
                "SELECT "
                    + label
                    + " AS lb FROM "
                    + cTable
                    + " c WHERE (c.region_id)::text = ? AND "
                    + cAlive
                    + " ORDER BY "
                    + label;
            List<String> rows = jdbc.query(q, (rs, i) -> rs.getString("lb"), regionId);
            String joined = joinCsvDistinct(rows);
            if (joined != null) {
                return joined;
            }
        } catch (Exception e) {
            log.debug("[admin-regions] countries (region_id::text): {}", e.getMessage());
        }
        try {
            String q2 =
                "SELECT "
                    + label
                    + " AS lb FROM "
                    + cTable
                    + " c WHERE c.region_id = ? AND "
                    + cAlive
                    + " ORDER BY "
                    + label;
            List<String> rows = jdbc.query(q2, (rs, i) -> rs.getString("lb"), regionId);
            return joinCsvDistinct(rows);
        } catch (Exception e) {
            log.debug("[admin-regions] countries (region_id direct bind): {}", e.getMessage());
            return null;
        }
    }

    private String aggregateCountriesByJunctionTable(String regionId, String cTable, String rcTable) {
        if (!schema.hasTable(rcTable) || !schema.hasTable(cTable)) {
            return null;
        }
        String regionCol = resolveRegionCountryRegionColumn(rcTable);
        String countryCol = resolveRegionCountryCountryColumn(rcTable);
        if (regionCol == null || countryCol == null) {
            return null;
        }
        String label = countryDisplayLabelSql(cTable, "c");
        if (label == null) {
            return null;
        }
        String cAlive = schema.hasColumn(cTable, "deleted_at") ? "c.deleted_at IS NULL" : "TRUE";
        String pk = resolveCountryPkColumn(cTable);

        List<String> onClauses = new ArrayList<>();
        if (pk != null) {
            onClauses.add("c." + pk + "::text = rc." + countryCol + "::text");
        }
        if (schema.hasColumn(cTable, "iso_2")) {
            onClauses.add("lower(trim(c.iso_2::text)) = lower(trim(rc." + countryCol + "::text))");
        }
        for (String on : onClauses) {
            try {
                String q =
                    "SELECT "
                        + label
                        + " AS lb FROM "
                        + rcTable
                        + " rc INNER JOIN "
                        + cTable
                        + " c ON "
                        + on
                        + " WHERE rc."
                        + regionCol
                        + "::text = ? AND "
                        + cAlive
                        + " ORDER BY "
                        + label;
                List<String> rows = jdbc.query(q, (rs, i) -> rs.getString("lb"), regionId);
                String joined = joinCsvDistinct(rows);
                if (joined != null) {
                    return joined;
                }
            } catch (Exception e) {
                log.debug("[admin-regions] junction ON {}: {}", on, e.getMessage());
            }
        }
        return null;
    }

    private String aggregateCountriesByRegionCountryJunction(String regionId, String cTable) {
        String s = aggregateCountriesByJunctionTable(regionId, cTable, "region_country");
        if (s != null) {
            return s;
        }
        return aggregateCountriesByJunctionTable(regionId, cTable, "region_countries");
    }

    private static String joinCsvDistinct(List<String> labels) {
        if (labels == null || labels.isEmpty()) {
            return null;
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (String s : labels) {
            if (s == null) {
                continue;
            }
            String t = s.trim();
            if (!t.isEmpty()) {
                seen.add(t);
            }
        }
        if (seen.isEmpty()) {
            return null;
        }
        return String.join(", ", seen);
    }

    /** display_name / name / iso — same labels as Medusa Admin. */
    private String countryDisplayLabelSql(String cTable, String alias) {
        String a = alias + ".";
        String isoCol = resolveCountryIsoColumn(cTable);
        if (schema.hasColumn(cTable, "display_name")) {
            if (isoCol != null) {
                return "COALESCE(NULLIF(trim(" + a + "display_name::text), ''), NULLIF(trim(" + a + "name::text), ''), "
                    + a
                    + isoCol
                    + "::text)";
            }
            return "COALESCE(NULLIF(trim(" + a + "display_name::text), ''), NULLIF(trim(" + a + "name::text), ''))";
        }
        if (schema.hasColumn(cTable, "name")) {
            if (isoCol != null) {
                return "COALESCE(NULLIF(trim(" + a + "name::text), ''), " + a + isoCol + "::text)";
            }
            return "NULLIF(trim(" + a + "name::text), '')";
        }
        if (isoCol != null) {
            return a + isoCol + "::text";
        }
        return null;
    }

    private String paymentProvidersDisplayForRegion(String rTable, String regionId) {
        String ppt = "region_payment_provider";
        String prov = "payment_provider";
        if (!schema.hasTable(ppt) || !schema.hasTable(prov)) {
            return "System (DEFAULT)";
        }
        String rCol = schema.hasColumn(ppt, "region_id") ? "region_id" : null;
        if (rCol == null) {
            return "System (DEFAULT)";
        }
        String pCol = schema.hasColumn(prov, "id") ? "id" : null;
        String nameCol = schema.hasColumn(prov, "name") ? "name" : null;
        if (pCol == null || nameCol == null) {
            return "System (DEFAULT)";
        }
        String fk = null;
        if (schema.hasColumn(ppt, "payment_provider_id")) {
            fk = "payment_provider_id";
        } else if (schema.hasColumn(ppt, "provider_id")) {
            fk = "provider_id";
        }
        if (fk == null) {
            return "System (DEFAULT)";
        }
        try {
            String alive = schema.hasColumn(prov, "deleted_at") ? "p.deleted_at IS NULL" : "TRUE";
            String q =
                "SELECT string_agg(p."
                    + nameCol
                    + "::text, ', ' ORDER BY p."
                    + nameCol
                    + ") FROM "
                    + ppt
                    + " rpp JOIN "
                    + prov
                    + " p ON p."
                    + pCol
                    + " = rpp."
                    + fk
                    + " WHERE rpp."
                    + rCol
                    + "::text = ? AND "
                    + alive;
            List<String> agg = jdbc.query(q, (rs, i) -> rs.getString(1), regionId.trim());
            if (agg.isEmpty() || agg.get(0) == null || agg.get(0).isBlank()) {
                return "System (DEFAULT)";
            }
            return agg.get(0) + " (DEFAULT)";
        } catch (Exception e) {
            return "System (DEFAULT)";
        }
    }

    public Map<String, Object> getRegionAdmin(String id) {
        if (id == null || id.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "region id required");
        }
        String rid = id.trim();
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region table not found");
        }
        Map<String, Object> row = loadRegionRow(rTable, rid);
        if (row == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region not found");
        }
        Map<String, Object> m = enrichRegionRow(rTable, row);
        m.put("countries_iso", listCountryIsosForRegion(rid));
        return m;
    }

    @Transactional
    public Map<String, Object> patchRegion(String id, JsonNode body) {
        if (id == null || id.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "region id required");
        }
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "JSON body required");
        }
        String rid = id.trim();
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region table not found");
        }
        if (loadRegionRow(rTable, rid) == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region not found");
        }
        List<String> sets = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        if (body.has("name") && !body.get("name").isNull()) {
            String name = text(body.get("name"));
            if (name != null && !name.isBlank() && schema.hasColumn(rTable, "name")) {
                sets.add("name = ?");
                vals.add(name.trim());
            }
        }
        if (body.has("currency_code") && !body.get("currency_code").isNull()) {
            String cc = normalizeCurrency(text(body.get("currency_code")));
            if (cc != null && !cc.isBlank() && schema.hasColumn(rTable, "currency_code")) {
                sets.add("currency_code = ?");
                vals.add(cc);
            }
        }
        Map<String, Object> metaPatch = new LinkedHashMap<>();
        if (body.has("automatic_taxes") && !body.get("automatic_taxes").isNull()) {
            boolean b = body.get("automatic_taxes").asBoolean(true);
            if (schema.hasColumn(rTable, "automatic_taxes")) {
                sets.add("automatic_taxes = ?");
                vals.add(b);
            } else {
                metaPatch.put("automatic_taxes", b);
            }
        }
        if (body.has("tax_inclusive_pricing") && !body.get("tax_inclusive_pricing").isNull()) {
            boolean b = body.get("tax_inclusive_pricing").asBoolean(false);
            if (schema.hasColumn(rTable, "includes_tax")) {
                sets.add("includes_tax = ?");
                vals.add(b);
            } else if (schema.hasColumn(rTable, "is_tax_inclusive")) {
                sets.add("is_tax_inclusive = ?");
                vals.add(b);
            } else if (schema.hasColumn(rTable, "tax_inclusive_pricing")) {
                sets.add("tax_inclusive_pricing = ?");
                vals.add(b);
            } else {
                metaPatch.put("tax_inclusive_pricing", b);
            }
        }
        boolean countryUpdate = body.has("countries") && body.get("countries").isArray();
        if (countryUpdate) {
            clearRegionCountryLinks(rid);
            linkCountries(rid, body.get("countries"));
        }
        if (!sets.isEmpty()) {
            if (schema.hasColumn(rTable, "updated_at")) {
                sets.add("updated_at = NOW()");
            }
            vals.add(rid);
            String sql = "UPDATE " + rTable + " SET " + String.join(", ", sets) + " WHERE id::text = ?";
            try {
                jdbc.update(sql, vals.toArray());
            } catch (Exception e) {
                throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not update region: " + e.getMessage());
            }
        } else if (countryUpdate && schema.hasColumn(rTable, "updated_at")) {
            jdbc.update("UPDATE " + rTable + " SET updated_at = NOW() WHERE id::text = ?", rid);
        }
        if (!metaPatch.isEmpty()) {
            mergeRegionMetadataPatch(rTable, rid, metaPatch);
        }
        Map<String, Object> row = loadRegionRow(rTable, rid);
        if (row == null) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Region not found after update");
        }
        return enrichRegionRow(rTable, row);
    }

    @Transactional
    public void deleteRegion(String id) {
        if (id == null || id.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "region id required");
        }
        String rid = id.trim();
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region table not found");
        }
        if (loadRegionRow(rTable, rid) == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region not found");
        }
        clearRegionCountryLinks(rid);
        int n;
        if (schema.hasColumn(rTable, "deleted_at")) {
            n =
                jdbc.update(
                    "UPDATE " + rTable + " SET deleted_at = NOW(), updated_at = NOW() WHERE id::text = ? AND deleted_at IS NULL",
                    rid
                );
        } else {
            try {
                n = jdbc.update("DELETE FROM " + rTable + " WHERE id::text = ?", rid);
            } catch (Exception e) {
                throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not delete region: " + e.getMessage());
            }
        }
        if (n != 1) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region not found or already deleted");
        }
    }

    private void clearRegionCountryLinks(String regionId) {
        if (regionId == null || regionId.isBlank()) {
            return;
        }
        String rid = regionId.trim();
        String cTable = countryTableName();
        String rcTable = "region_country";
        /** Do not DELETE from {@code region_country} in Medusa v2 — that table is the ISO catalog (PK {@code iso_2}). */
        if (schema.hasTable(rcTable) && !isMedusaV2RegionCountryCatalogTable()) {
            String regionCol = resolveRegionCountryRegionColumn(rcTable);
            if (regionCol != null) {
                try {
                    jdbc.update("DELETE FROM " + rcTable + " WHERE " + regionCol + "::text = ?", rid);
                } catch (Exception e) {
                    log.debug("[admin-regions] clear junction {}: {}", rcTable, e.getMessage());
                }
            }
        }
        if (schema.hasTable("region_countries")) {
            String regionCol = resolveRegionCountryRegionColumn("region_countries");
            if (regionCol != null) {
                try {
                    jdbc.update("DELETE FROM region_countries WHERE " + regionCol + "::text = ?", rid);
                } catch (Exception e) {
                    log.debug("[admin-regions] clear junction region_countries: {}", e.getMessage());
                }
            }
        }
        if (schema.hasTable(cTable) && schema.hasColumn(cTable, "region_id")) {
            try {
                StringBuilder u = new StringBuilder("UPDATE ").append(cTable).append(" SET region_id = NULL");
                if (schema.hasColumn(cTable, "updated_at")) {
                    u.append(", updated_at = NOW()");
                }
                u.append(" WHERE (region_id)::text = ?");
                jdbc.update(u.toString(), rid);
            } catch (Exception e) {
                log.debug("[admin-regions] clear country.region_id (::text): {}", e.getMessage());
                try {
                    jdbc.update("UPDATE " + cTable + " SET region_id = NULL WHERE region_id = ?", rid);
                } catch (Exception e2) {
                    log.debug("[admin-regions] clear country.region_id: {}", e2.getMessage());
                }
            }
        }
    }

    /**
     * Lowercase ISO-3166 alpha-2 codes linked to the region (for admin edit form).
     */
    private List<String> listCountryIsosForRegion(String regionId) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        String cTable = countryTableName();
        if (!schema.hasTable(cTable)) {
            return new ArrayList<>();
        }
        String isoCol = resolveCountryIsoColumn(cTable);
        if (isoCol == null) {
            return new ArrayList<>();
        }
        String rid = regionId.trim();
        String cAlive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String pk = resolveCountryPkColumn(cTable);
        if (schema.hasColumn(cTable, "region_id")) {
            try {
                jdbc.query(
                    "SELECT lower(trim(" + isoCol + "::text)) AS iso FROM " + cTable + " WHERE (region_id)::text = ? AND " + cAlive,
                    (rs, i) -> {
                        String s = rs.getString("iso");
                        if (s != null && !s.isBlank()) {
                            out.add(s.trim().toLowerCase(Locale.ROOT));
                        }
                        return null;
                    },
                    rid
                );
            } catch (Exception e) {
                log.debug("[admin-regions] listCountryIsos region_id::text: {}", e.getMessage());
            }
            try {
                jdbc.query(
                    "SELECT lower(trim(" + isoCol + "::text)) AS iso FROM " + cTable + " WHERE region_id = ? AND " + cAlive,
                    (rs, i) -> {
                        String s = rs.getString("iso");
                        if (s != null && !s.isBlank()) {
                            out.add(s.trim().toLowerCase(Locale.ROOT));
                        }
                        return null;
                    },
                    rid
                );
            } catch (Exception e) {
                log.debug("[admin-regions] listCountryIsos region_id: {}", e.getMessage());
            }
        }
        if (pk != null) {
            for (String jt : List.of("region_country", "region_countries")) {
                if (!schema.hasTable(jt)) {
                    continue;
                }
                String regionCol = resolveRegionCountryRegionColumn(jt);
                String countryCol = resolveRegionCountryCountryColumn(jt);
                if (regionCol == null || countryCol == null) {
                    continue;
                }
                List<String> onClauses = new ArrayList<>();
                onClauses.add("c." + pk + "::text = rc." + countryCol + "::text");
                if (schema.hasColumn(cTable, "iso_2")) {
                    onClauses.add("lower(trim(c.iso_2::text)) = lower(trim(rc." + countryCol + "::text))");
                }
                for (String on : onClauses) {
                    try {
                        String q =
                            "SELECT lower(trim(c."
                                + isoCol
                                + "::text)) AS iso FROM "
                                + jt
                                + " rc INNER JOIN "
                                + cTable
                                + " c ON "
                                + on
                                + " WHERE rc."
                                + regionCol
                                + "::text = ? AND "
                                + cAlive;
                        jdbc.query(
                            q,
                            (rs, i) -> {
                                String s = rs.getString("iso");
                                if (s != null && !s.isBlank()) {
                                    out.add(s.trim().toLowerCase(Locale.ROOT));
                                }
                                return null;
                            },
                            rid
                        );
                    } catch (Exception e) {
                        log.debug("[admin-regions] listCountryIsos junction {} ON {}: {}", jt, on, e.getMessage());
                    }
                }
            }
        }
        return new ArrayList<>(out);
    }

    private static boolean truthy(Object o) {
        if (o == null) {
            return false;
        }
        if (o instanceof Boolean b) {
            return b;
        }
        if (o instanceof Number n) {
            return n.intValue() != 0;
        }
        String s = o.toString().trim().toLowerCase(Locale.ROOT);
        return "true".equals(s) || "t".equals(s) || "1".equals(s);
    }

    private JsonNode parseMetadataJson(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            if (raw instanceof PGobject g) {
                String s = g.getValue();
                if (s == null || s.isBlank()) {
                    return null;
                }
                return objectMapper.readTree(s);
            }
            if (raw instanceof String s) {
                if (s.isBlank()) {
                    return null;
                }
                return objectMapper.readTree(s);
            }
            return objectMapper.valueToTree(raw);
        } catch (Exception e) {
            log.debug("[admin-regions] parseMetadataJson: {}", e.getMessage());
            return null;
        }
    }

    private Boolean readMetadataBoolean(String rTable, Map<String, Object> row, String key) {
        if (!schema.hasColumn(rTable, "metadata") || row.get("metadata") == null) {
            return null;
        }
        try {
            JsonNode root = parseMetadataJson(row.get("metadata"));
            if (root != null && root.isObject() && root.has(key) && !root.get(key).isNull()) {
                JsonNode v = root.get(key);
                if (v.isBoolean()) {
                    return v.asBoolean();
                }
                if (v.isNumber()) {
                    return v.intValue() != 0;
                }
                if (v.isTextual()) {
                    return truthy(v.asText());
                }
            }
        } catch (Exception e) {
            log.debug("[admin-regions] readMetadataBoolean {}: {}", key, e.getMessage());
        }
        return null;
    }

    private void mergeRegionMetadataPatch(String rTable, String regionId, Map<String, Object> patches) {
        if (patches == null || patches.isEmpty()) {
            return;
        }
        if (!schema.hasColumn(rTable, "metadata") || !schema.columnIsJsonb(rTable, "metadata")) {
            throw new ProductWriteException(
                HttpStatus.BAD_REQUEST,
                "Region table has no jsonb metadata column; cannot persist tax settings"
            );
        }
        Map<String, Object> row = loadRegionRow(rTable, regionId);
        if (row == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Region not found");
        }
        try {
            JsonNode parsed = parseMetadataJson(row.get("metadata"));
            ObjectNode root;
            if (parsed != null && parsed.isObject()) {
                root = (ObjectNode) parsed;
            } else {
                root = objectMapper.createObjectNode();
            }
            for (Map.Entry<String, Object> e : patches.entrySet()) {
                Object val = e.getValue();
                if (val instanceof Boolean b) {
                    root.put(e.getKey(), b);
                } else if (val instanceof Number n) {
                    root.put(e.getKey(), n.doubleValue());
                } else if (val != null) {
                    root.put(e.getKey(), val.toString());
                }
            }
            PGobject pg = new PGobject();
            pg.setType("jsonb");
            pg.setValue(objectMapper.writeValueAsString(root));
            StringBuilder sb = new StringBuilder("UPDATE ").append(rTable).append(" SET metadata = ?");
            List<Object> uvals = new ArrayList<>();
            uvals.add(pg);
            if (schema.hasColumn(rTable, "updated_at")) {
                sb.append(", updated_at = NOW()");
            }
            sb.append(" WHERE id::text = ?");
            uvals.add(regionId);
            jdbc.update(sb.toString(), uvals.toArray());
        } catch (ProductWriteException e) {
            throw e;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not update region metadata: " + e.getMessage());
        }
    }

    private boolean readAutomaticTaxesFromRow(String rTable, Map<String, Object> row) {
        if (schema.hasColumn(rTable, "automatic_taxes")) {
            return truthy(row.get("automatic_taxes"));
        }
        Boolean fromMeta = readMetadataBoolean(rTable, row, "automatic_taxes");
        return fromMeta != null ? fromMeta : true;
    }

    private boolean readTaxInclusiveFromRow(String rTable, Map<String, Object> row) {
        if (schema.hasColumn(rTable, "includes_tax")) {
            return truthy(row.get("includes_tax"));
        }
        if (schema.hasColumn(rTable, "is_tax_inclusive")) {
            return truthy(row.get("is_tax_inclusive"));
        }
        if (schema.hasColumn(rTable, "tax_inclusive_pricing")) {
            return truthy(row.get("tax_inclusive_pricing"));
        }
        Boolean fromMeta = readMetadataBoolean(rTable, row, "tax_inclusive_pricing");
        return fromMeta != null ? fromMeta : false;
    }

    private List<Map<String, String>> listCountryOptions() {
        String cTable = countryTableName();
        if (!schema.hasTable(cTable)) {
            log.warn(
                "[admin-regions] country_options: table \"{}\" not found in public schema. Set CATALOG_COUNTRY_TABLE or run Medusa migrations.",
                cTable
            );
            return List.of();
        }
        String isoCol = resolveCountryIsoColumn(cTable);
        if (isoCol == null) {
            log.warn(
                "[admin-regions] country_options: table \"{}\" has no iso_2/iso2 column.",
                cTable
            );
            return List.of();
        }
        String labelExpr;
        if (schema.hasColumn(cTable, "display_name")) {
            labelExpr = "COALESCE(NULLIF(trim(display_name::text), ''), NULLIF(trim(name::text), ''), " + isoCol + "::text)";
        } else if (schema.hasColumn(cTable, "name")) {
            labelExpr = "COALESCE(NULLIF(trim(name::text), ''), " + isoCol + "::text)";
        } else {
            labelExpr = isoCol + "::text";
        }
        String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            List<Map<String, String>> rows =
                jdbc.query(
                    "SELECT lower(trim(" + isoCol + "::text)) AS iso_2, " + labelExpr + " AS display_name FROM "
                        + cTable
                        + " WHERE "
                        + alive
                        + " ORDER BY "
                        + labelExpr
                        + " NULLS LAST LIMIT 500",
                    (rs, i) -> {
                        Map<String, String> m = new LinkedHashMap<>();
                        m.put("iso_2", rs.getString("iso_2"));
                        m.put("display_name", rs.getString("display_name"));
                        return m;
                    }
                );
            if (rows.isEmpty()) {
                log.warn(
                    "[admin-regions] country_options: table \"{}\" returned no rows. Seed ISO countries from the Medusa app directory: npx medusa exec ./src/scripts/seed-region-countries.ts",
                    cTable
                );
            }
            return rows;
        } catch (Exception e) {
            log.warn("[admin-regions] country_options query failed: {}", e.getMessage());
            return List.of();
        }
    }

    private static String text(JsonNode n) {
        if (n == null || n.isNull()) {
            return null;
        }
        if (!n.isTextual()) {
            return n.asText(null);
        }
        String s = n.asText();
        return s == null ? null : s;
    }

    private static String normalizeCurrency(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeIso(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim().toLowerCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }

    private static String sanitizeTable(String name) {
        if (name == null || name.isBlank()) {
            return "region";
        }
        return name.replaceAll("[^a-zA-Z0-9_]", "").toLowerCase(Locale.ROOT);
    }

    /** Configured catalog {@code country} table (Medusa default {@code country}). */
    private String countryTableName() {
        return sanitizeTable(props.getCountryTable());
    }
}
