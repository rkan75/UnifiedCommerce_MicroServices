package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Admin tax regions backed by Medusa Tax module tables {@code tax_region}, {@code tax_rate}, {@code tax_provider}.
 *
 * <p>Aligns with Medusa v2 {@code TaxRegion}: geographic scope via {@code country_code} / optional
 * {@code province_code}, optional {@code parent_id} for sublevel regions, and {@code provider_id} for the tax
 * calculator. Default checkout tax is represented by a default row in {@code tax_rate} for the region.
 */
@Service
public class AdminTaxRegionService {

    private static final Logger log = LoggerFactory.getLogger(AdminTaxRegionService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final CatalogSchemaCache schema;
    private final ObjectMapper objectMapper;

    public AdminTaxRegionService(
        JdbcTemplate jdbc,
        ProductsProperties props,
        CatalogSchemaCache schema,
        ObjectMapper objectMapper
    ) {
        this.jdbc = jdbc;
        this.props = props;
        this.schema = schema;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> listTaxRegionsAdminResponse() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tax_regions", listTopLevelTaxRegions());
        return out;
    }

    public List<Map<String, Object>> listTaxProviders() {
        String tp = sanitizeTable(props.getTaxProviderTable());
        if (!schema.hasTable(tp)) {
            return List.of();
        }
        String alive = schema.hasColumn(tp, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String sql = "SELECT id FROM " + tp + " WHERE " + alive + " ORDER BY id ASC";
        return jdbc.queryForList(sql);
    }

    public Map<String, Object> getTaxRegionAdmin(String id) {
        if (id == null || id.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "tax region id required");
        }
        String tr = sanitizeTable(props.getTaxRegionTable());
        if (!schema.hasTable(tr)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "tax_region table not found");
        }
        Map<String, Object> row = loadTaxRegionRow(tr, id.trim());
        if (row == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Tax region not found");
        }
        return enrichTaxRegionRow(tr, row);
    }

    @Transactional
    public Map<String, Object> createTaxRegion(JsonNode body) {
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "JSON body required");
        }
        String tr = sanitizeTable(props.getTaxRegionTable());
        if (!schema.hasTable(tr)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "tax_region table not found");
        }
        String cc = normalizeIso2(text(body.get("country_code")));
        if (cc == null || cc.length() != 2) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "country_code is required (ISO 3166-1 alpha-2)");
        }
        if (hasParentColumn(tr) && !body.has("parent_id")) {
            if (existsTopLevelForCountry(tr, cc)) {
                throw new ProductWriteException(
                    HttpStatus.BAD_REQUEST,
                    "A tax region for this country already exists. Edit it or add a sublevel region instead."
                );
            }
        }
        String id = newTaxRegionId();
        String province = text(body.get("province_code"));
        if (province != null) {
            province = province.trim().toLowerCase(Locale.ROOT);
            if (province.isEmpty()) {
                province = null;
            }
        }
        String parentId = text(body.get("parent_id"));
        if (parentId != null) {
            parentId = parentId.trim();
            if (parentId.isEmpty()) {
                parentId = null;
            }
        }
        String providerId = text(body.get("provider_id"));
        if (providerId != null) {
            providerId = providerId.trim();
            if (providerId.isEmpty()) {
                providerId = null;
            }
        }

        insertTaxRegionRow(tr, id, cc, province, parentId, providerId);
        upsertDefaultTaxRateFromBody(id, body.get("default_tax_rate"), true);

        Map<String, Object> row = loadTaxRegionRow(tr, id);
        if (row == null) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Tax region created but could not be reloaded");
        }
        return enrichTaxRegionRow(tr, row);
    }

    @Transactional
    public Map<String, Object> patchTaxRegion(String id, JsonNode body) {
        if (id == null || id.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "tax region id required");
        }
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "JSON body required");
        }
        String tr = sanitizeTable(props.getTaxRegionTable());
        if (!schema.hasTable(tr)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "tax_region table not found");
        }
        String rid = id.trim();
        if (loadTaxRegionRow(tr, rid) == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Tax region not found");
        }

        List<String> sets = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        if (body.has("country_code") && !body.get("country_code").isNull()) {
            String cc = normalizeIso2(text(body.get("country_code")));
            if (cc == null || cc.length() != 2) {
                throw new ProductWriteException(HttpStatus.BAD_REQUEST, "country_code must be ISO 3166-1 alpha-2");
            }
            if (schema.hasColumn(tr, "country_code")) {
                sets.add("country_code = ?");
                vals.add(cc);
            }
        }
        if (body.has("province_code")) {
            if (body.get("province_code").isNull()) {
                if (schema.hasColumn(tr, "province_code")) {
                    sets.add("province_code = ?");
                    vals.add(null);
                }
            } else {
                String p = text(body.get("province_code"));
                if (p != null) {
                    p = p.trim().toLowerCase(Locale.ROOT);
                }
                if (schema.hasColumn(tr, "province_code")) {
                    sets.add("province_code = ?");
                    vals.add(p == null || p.isEmpty() ? null : p);
                }
            }
        }
        if (body.has("provider_id")) {
            String pid = text(body.get("provider_id"));
            if (pid != null) {
                pid = pid.trim();
                if (pid.isEmpty()) {
                    pid = null;
                }
            }
            if (schema.hasColumn(tr, "provider_id")) {
                sets.add("provider_id = ?");
                vals.add(pid);
            }
        }
        if (!sets.isEmpty() && schema.hasColumn(tr, "updated_at")) {
            sets.add("updated_at = NOW()");
        }
        if (!sets.isEmpty()) {
            vals.add(rid);
            String sql = "UPDATE " + tr + " SET " + String.join(", ", sets) + " WHERE id::text = ?";
            try {
                jdbc.update(sql, vals.toArray());
            } catch (Exception e) {
                throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not update tax region: " + e.getMessage());
            }
        }

        if (body.has("default_tax_rate")) {
            upsertDefaultTaxRateFromBody(rid, body.get("default_tax_rate"), false);
        }

        Map<String, Object> row = loadTaxRegionRow(tr, rid);
        if (row == null) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Tax region not found after update");
        }
        return enrichTaxRegionRow(tr, row);
    }

    @Transactional
    public void deleteTaxRegion(String id) {
        if (id == null || id.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "tax region id required");
        }
        String tr = sanitizeTable(props.getTaxRegionTable());
        if (!schema.hasTable(tr)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "tax_region table not found");
        }
        String rid = id.trim();
        if (loadTaxRegionRow(tr, rid) == null) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Tax region not found");
        }
        if (hasParentColumn(tr) && countChildRegions(tr, rid) > 0) {
            throw new ProductWriteException(
                HttpStatus.BAD_REQUEST,
                "Remove or delete sublevel tax regions before deleting this tax region."
            );
        }
        softDeleteRatesForRegion(rid);
        int n = softDeleteTaxRegionRow(tr, rid);
        if (n == 0) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Tax region not found or already deleted");
        }
    }

    private List<Map<String, Object>> listTopLevelTaxRegions() {
        String tr = sanitizeTable(props.getTaxRegionTable());
        List<Map<String, Object>> out = new ArrayList<>();
        if (!schema.hasTable(tr)) {
            log.warn("[admin-tax-regions] table \"{}\" missing", tr);
            return out;
        }
        String alive = schema.hasColumn(tr, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String parentFilter = hasParentColumn(tr) ? "parent_id IS NULL" : "TRUE";
        String sql = "SELECT * FROM " + tr + " WHERE " + alive + " AND " + parentFilter + " ORDER BY country_code ASC";
        List<Map<String, Object>> raw = jdbc.queryForList(sql);
        for (Map<String, Object> row : raw) {
            out.add(enrichTaxRegionRow(tr, row));
        }
        return out;
    }

    private Map<String, Object> enrichTaxRegionRow(String trTable, Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        String id = stringVal(row.get("id"));
        m.put("id", id);
        String cc = stringVal(row.get("country_code"));
        if (cc != null) {
            cc = cc.trim().toLowerCase(Locale.ROOT);
        }
        m.put("country_code", cc);
        m.put("country_name", resolveCountryName(cc));
        if (row.containsKey("province_code")) {
            m.put("province_code", row.get("province_code"));
        }
        if (row.containsKey("parent_id")) {
            m.put("parent_id", row.get("parent_id"));
        }
        if (row.containsKey("provider_id")) {
            m.put("provider_id", row.get("provider_id"));
        }
        m.put("created_at", row.get("created_at"));
        m.put("updated_at", row.get("updated_at"));
        m.put("default_tax_rate", loadDefaultTaxRateMap(id));
        if (hasParentColumn(trTable) && id != null) {
            m.put("subregion_count", countChildRegions(trTable, id));
        } else {
            m.put("subregion_count", 0);
        }
        return m;
    }

    private Map<String, Object> loadDefaultTaxRateMap(String taxRegionId) {
        String rt = sanitizeTable(props.getTaxRateTable());
        if (!schema.hasTable(rt) || !schema.hasColumn(rt, "tax_region_id")) {
            return null;
        }
        String alive = schema.hasColumn(rt, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String order = schema.hasColumn(rt, "is_default")
            ? "ORDER BY CASE WHEN is_default THEN 0 ELSE 1 END, created_at ASC"
            : "ORDER BY created_at ASC";
        String sql =
            "SELECT * FROM "
                + rt
                + " WHERE tax_region_id::text = ? AND "
                + alive
                + " "
                + order
                + " LIMIT 1";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, taxRegionId);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> r = rows.get(0);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id"));
        m.put("name", r.get("name"));
        m.put("code", r.get("code"));
        m.put("rate", formatRateForApi(r.get("rate")));
        if (r.containsKey("is_default")) {
            m.put("is_default", r.get("is_default"));
        }
        return m;
    }

    private Object formatRateForApi(Object rateCol) {
        if (rateCol == null) {
            return null;
        }
        if (rateCol instanceof BigDecimal bd) {
            return bd.setScale(4, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
        }
        if (rateCol instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(4, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
        }
        return rateCol;
    }

    private void insertTaxRegionRow(
        String tr,
        String id,
        String countryCode,
        String provinceCode,
        String parentId,
        String providerId
    ) {
        List<String> cols = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        cols.add("id");
        vals.add(id);
        if (schema.hasColumn(tr, "country_code")) {
            cols.add("country_code");
            vals.add(countryCode);
        }
        if (schema.hasColumn(tr, "province_code")) {
            cols.add("province_code");
            vals.add(provinceCode);
        }
        if (schema.hasColumn(tr, "parent_id")) {
            cols.add("parent_id");
            vals.add(parentId);
        }
        if (schema.hasColumn(tr, "provider_id")) {
            cols.add("provider_id");
            vals.add(providerId);
        }
        if (schema.hasColumn(tr, "created_at")) {
            cols.add("created_at");
            vals.add(new java.sql.Timestamp(System.currentTimeMillis()));
        }
        if (schema.hasColumn(tr, "updated_at")) {
            cols.add("updated_at");
            vals.add(new java.sql.Timestamp(System.currentTimeMillis()));
        }
        if (schema.hasColumn(tr, "deleted_at")) {
            cols.add("deleted_at");
            vals.add(null);
        }
        if (schema.hasColumn(tr, "metadata") && schema.columnIsJsonb(tr, "metadata")) {
            cols.add("metadata");
            vals.add(null);
        }
        String placeholders = String.join(", ", cols.stream().map(c -> "?").toList());
        String sql = "INSERT INTO " + tr + " (" + String.join(", ", cols) + ") VALUES (" + placeholders + ")";
        try {
            jdbc.update(sql, vals.toArray());
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Could not create tax region: " + e.getMessage());
        }
    }

    private void upsertDefaultTaxRateFromBody(String taxRegionId, JsonNode dtr, boolean onCreate) {
        if (dtr == null || dtr.isNull() || !dtr.isObject()) {
            if (onCreate) {
                insertDefaultSystemRateIfPossible(taxRegionId);
            }
            return;
        }
        String rt = sanitizeTable(props.getTaxRateTable());
        if (!schema.hasTable(rt) || !schema.hasColumn(rt, "tax_region_id")) {
            return;
        }
        String name = text(dtr.get("name"));
        if (name == null || name.isBlank()) {
            name = "default";
        }
        String code = text(dtr.get("code"));
        if (code == null || code.isBlank()) {
            code = "default";
        }
        BigDecimal rateBd = parseRate(dtr.get("rate"));

        if (!onCreate) {
            String existingRateId = findPrimaryRateId(taxRegionId);
            if (existingRateId != null) {
                updateTaxRateRow(rt, existingRateId, name, code, rateBd);
                return;
            }
        }

        String rateId = newTaxRateId();
        clearDefaultFlags(taxRegionId);

        List<String> cols = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        cols.add("id");
        vals.add(rateId);
        cols.add("tax_region_id");
        vals.add(taxRegionId);
        if (schema.hasColumn(rt, "name")) {
            cols.add("name");
            vals.add(name);
        }
        if (schema.hasColumn(rt, "code")) {
            cols.add("code");
            vals.add(code);
        }
        if (schema.hasColumn(rt, "rate")) {
            cols.add("rate");
            vals.add(rateBd);
        }
        if (schema.hasColumn(rt, "is_default")) {
            cols.add("is_default");
            vals.add(Boolean.TRUE);
        }
        if (schema.hasColumn(rt, "is_combinable")) {
            cols.add("is_combinable");
            vals.add(Boolean.TRUE);
        }
        if (schema.hasColumn(rt, "created_at")) {
            cols.add("created_at");
            vals.add(new java.sql.Timestamp(System.currentTimeMillis()));
        }
        if (schema.hasColumn(rt, "updated_at")) {
            cols.add("updated_at");
            vals.add(new java.sql.Timestamp(System.currentTimeMillis()));
        }
        if (schema.hasColumn(rt, "deleted_at")) {
            cols.add("deleted_at");
            vals.add(null);
        }
        if (schema.hasColumn(rt, "metadata") && schema.columnIsJsonb(rt, "metadata")) {
            cols.add("metadata");
            vals.add(null);
        }
        if (schema.hasColumn(rt, "provider_id")) {
            cols.add("provider_id");
            vals.add(null);
        }
        String placeholders = String.join(", ", cols.stream().map(c -> "?").toList());
        String sql = "INSERT INTO " + rt + " (" + String.join(", ", cols) + ") VALUES (" + placeholders + ")";
        jdbc.update(sql, vals.toArray());
    }

    private String findPrimaryRateId(String taxRegionId) {
        String rt = sanitizeTable(props.getTaxRateTable());
        if (!schema.hasTable(rt) || !schema.hasColumn(rt, "tax_region_id")) {
            return null;
        }
        String alive = schema.hasColumn(rt, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String order = schema.hasColumn(rt, "is_default")
            ? "ORDER BY CASE WHEN is_default THEN 0 ELSE 1 END, created_at ASC"
            : "ORDER BY created_at ASC";
        String sql =
            "SELECT id FROM "
                + rt
                + " WHERE tax_region_id::text = ? AND "
                + alive
                + " "
                + order
                + " LIMIT 1";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, taxRegionId);
        if (rows.isEmpty()) {
            return null;
        }
        Object id = rows.get(0).get("id");
        return id != null ? String.valueOf(id) : null;
    }

    private void updateTaxRateRow(String rt, String rateId, String name, String code, BigDecimal rateBd) {
        List<String> sets = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        if (schema.hasColumn(rt, "name")) {
            sets.add("name = ?");
            vals.add(name);
        }
        if (schema.hasColumn(rt, "code")) {
            sets.add("code = ?");
            vals.add(code);
        }
        if (schema.hasColumn(rt, "rate")) {
            sets.add("rate = ?");
            vals.add(rateBd);
        }
        if (schema.hasColumn(rt, "is_default")) {
            sets.add("is_default = ?");
            vals.add(Boolean.TRUE);
        }
        if (schema.hasColumn(rt, "updated_at")) {
            sets.add("updated_at = NOW()");
        }
        vals.add(rateId);
        String sql = "UPDATE " + rt + " SET " + String.join(", ", sets) + " WHERE id::text = ?";
        jdbc.update(sql, vals.toArray());
    }

    /** When the admin omits a default rate, align with Medusa seed: 0% default so checkout has a line. */
    private void insertDefaultSystemRateIfPossible(String taxRegionId) {
        ObjectNode n = objectMapper.createObjectNode();
        n.put("name", "default");
        n.put("code", "default");
        n.put("rate", 0);
        upsertDefaultTaxRateFromBody(taxRegionId, n, false);
    }

    private void clearDefaultFlags(String taxRegionId) {
        String rt = sanitizeTable(props.getTaxRateTable());
        if (!schema.hasTable(rt) || !schema.hasColumn(rt, "is_default")) {
            return;
        }
        String alive = schema.hasColumn(rt, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        jdbc.update(
            "UPDATE " + rt + " SET is_default = false WHERE tax_region_id::text = ? AND " + alive,
            taxRegionId
        );
    }

    private BigDecimal parseRate(JsonNode n) {
        if (n == null || n.isNull()) {
            return BigDecimal.ZERO;
        }
        if (n.isNumber()) {
            return BigDecimal.valueOf(n.asDouble()).setScale(6, RoundingMode.HALF_UP);
        }
        if (n.isTextual()) {
            try {
                return new BigDecimal(n.asText().trim()).setScale(6, RoundingMode.HALF_UP);
            } catch (Exception e) {
                return BigDecimal.ZERO;
            }
        }
        return BigDecimal.ZERO;
    }

    private void softDeleteRatesForRegion(String taxRegionId) {
        String rt = sanitizeTable(props.getTaxRateTable());
        if (!schema.hasTable(rt) || !schema.hasColumn(rt, "deleted_at")) {
            return;
        }
        jdbc.update("UPDATE " + rt + " SET deleted_at = NOW() WHERE tax_region_id::text = ? AND deleted_at IS NULL", taxRegionId);
    }

    private int softDeleteTaxRegionRow(String tr, String id) {
        if (!schema.hasColumn(tr, "deleted_at")) {
            return jdbc.update("DELETE FROM " + tr + " WHERE id::text = ?", id);
        }
        return jdbc.update("UPDATE " + tr + " SET deleted_at = NOW() WHERE id::text = ? AND deleted_at IS NULL", id);
    }

    private long countChildRegions(String tr, String parentId) {
        if (!hasParentColumn(tr)) {
            return 0;
        }
        String alive = schema.hasColumn(tr, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        Long c =
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + tr + " WHERE parent_id::text = ? AND " + alive,
                Long.class,
                parentId
            );
        return c == null ? 0 : c;
    }

    private boolean existsTopLevelForCountry(String tr, String countryLower2) {
        if (!hasParentColumn(tr)) {
            return false;
        }
        String alive = schema.hasColumn(tr, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        Long c =
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM "
                    + tr
                    + " WHERE "
                    + alive
                    + " AND parent_id IS NULL AND lower(country_code::text) = ?",
                Long.class,
                countryLower2
            );
        return c != null && c > 0;
    }

    private boolean hasParentColumn(String tr) {
        return schema.hasColumn(tr, "parent_id");
    }

    private Map<String, Object> loadTaxRegionRow(String tr, String id) {
        String alive = schema.hasColumn(tr, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        List<Map<String, Object>> rows =
            jdbc.queryForList("SELECT * FROM " + tr + " WHERE id::text = ? AND " + alive, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String resolveCountryName(String iso2Lower) {
        if (iso2Lower == null || iso2Lower.length() != 2) {
            return null;
        }
        String cTable = sanitizeTable(props.getCountryTable());
        if (!schema.hasTable(cTable) || !schema.hasColumn(cTable, "iso_2")) {
            return iso2Lower.toUpperCase(Locale.ROOT);
        }
        String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String labelExpr;
        if (schema.hasColumn(cTable, "display_name")) {
            labelExpr =
                "COALESCE(NULLIF(trim(display_name::text), ''), NULLIF(trim(name::text), ''), iso_2::text)";
        } else if (schema.hasColumn(cTable, "name")) {
            labelExpr = "COALESCE(NULLIF(trim(name::text), ''), iso_2::text)";
        } else {
            labelExpr = "iso_2::text";
        }
        List<Map<String, Object>> rows =
            jdbc.queryForList(
                "SELECT "
                    + labelExpr
                    + " AS n FROM "
                    + cTable
                    + " WHERE lower(iso_2::text) = ? AND "
                    + alive
                    + " LIMIT 1",
                iso2Lower
            );
        if (rows.isEmpty()) {
            return iso2Lower.toUpperCase(Locale.ROOT);
        }
        Object n = rows.get(0).get("n");
        return n != null ? n.toString() : iso2Lower.toUpperCase(Locale.ROOT);
    }

    private static String stringVal(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static String newTaxRegionId() {
        return "txreg_" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String newTaxRateId() {
        return "txrate_" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String sanitizeTable(String raw) {
        if (raw == null || raw.isBlank()) {
            return "tax_region";
        }
        String s = raw.trim().toLowerCase(Locale.ROOT);
        if (!s.matches("[a-z0-9_]+")) {
            return "tax_region";
        }
        return s;
    }

    private static String normalizeIso2(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim().toLowerCase(Locale.ROOT);
        if (t.length() == 2) {
            return t;
        }
        return t;
    }

    private static String text(JsonNode n) {
        if (n == null || n.isNull()) {
            return null;
        }
        if (n.isTextual()) {
            return n.asText();
        }
        if (n.isNumber()) {
            return n.asText();
        }
        if (n.isBoolean()) {
            return n.asBoolean() ? "true" : "false";
        }
        return n.toString();
    }
}
