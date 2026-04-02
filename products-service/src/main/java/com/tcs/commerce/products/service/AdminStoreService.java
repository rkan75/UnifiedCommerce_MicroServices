package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Admin store settings: reads/writes the Medusa {@code store} row and loads option lists from catalog tables.
 */
@Service
public class AdminStoreService {

    private static final Logger log = LoggerFactory.getLogger(AdminStoreService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final CatalogSchemaCache schema;
    private final ObjectMapper objectMapper;

    public AdminStoreService(JdbcTemplate jdbc, ProductsProperties props, CatalogSchemaCache schema, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.props = props;
        this.schema = schema;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> getStoreAdmin() {
        String storeT = sanitizeTable(props.getStoreTable());
        if (!schema.hasTable(storeT)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Store table not found in catalog database");
        }
        Map<String, Object> row = loadStoreRow(storeT);
        if (row == null || row.isEmpty()) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "No store row found (store table is empty)");
        }
        Map<String, Object> store = enrichStore(row);
        Map<String, Object> options = loadOptions();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("store", store);
        out.put("options", options);
        return out;
    }

    @Transactional
    public Map<String, Object> patchStore(JsonNode body) {
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "JSON body required");
        }
        String storeT = sanitizeTable(props.getStoreTable());
        if (!schema.hasTable(storeT)) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Store table not found");
        }
        Map<String, Object> row = loadStoreRow(storeT);
        if (row == null || row.isEmpty()) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "No store row found");
        }
        String storeId = Objects.toString(row.get("id"), "").trim();
        if (storeId.isEmpty()) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Store row has no id");
        }

        String name = text(body.get("name"));
        if (name == null || name.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "name is required");
        }

        String channelId = emptyToNull(text(body.get("default_sales_channel_id")));
        String regionId = emptyToNull(text(body.get("default_region_id")));
        String locationId = emptyToNull(text(body.get("default_location_id")));
        String currencyCode = normalizeCurrency(text(body.get("default_currency_code")));

        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("UPDATE ").append(storeT).append(" SET name = ?, updated_at = NOW()");
        args.add(name.trim());

        if (schema.hasColumn(storeT, "default_sales_channel_id")) {
            sql.append(", default_sales_channel_id = ?");
            args.add(channelId);
        }
        if (schema.hasColumn(storeT, "default_region_id")) {
            sql.append(", default_region_id = ?");
            args.add(regionId);
        }
        if (schema.hasColumn(storeT, "default_location_id")) {
            sql.append(", default_location_id = ?");
            args.add(locationId);
        }
        if (schema.hasColumn(storeT, "default_currency_code") && currencyCode != null) {
            sql.append(", default_currency_code = ?");
            args.add(currencyCode);
        }

        sql.append(" WHERE id::text = ? AND deleted_at IS NULL");
        args.add(storeId);

        int n = jdbc.update(sql.toString(), args.toArray());
        if (n != 1) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Store update affected " + n + " rows");
        }

        String regionForCurrency = regionId != null ? regionId : emptyToNull(Objects.toString(row.get("default_region_id"), null));
        if (currencyCode != null
            && !schema.hasColumn(storeT, "default_currency_code")
            && regionForCurrency != null) {
            patchRegionCurrency(regionForCurrency, currencyCode);
        }

        return getStoreAdmin();
    }

    private void patchRegionCurrency(String regionId, String currencyCode) {
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable) || !schema.hasColumn(rTable, "currency_code")) {
            log.debug("[admin-store] skip region currency: no region table or currency_code column");
            return;
        }
        jdbc.update(
            "UPDATE " + rTable + " SET currency_code = ?, updated_at = NOW() WHERE id::text = ? AND deleted_at IS NULL",
            currencyCode,
            regionId.trim()
        );
    }

    private Map<String, Object> loadStoreRow(String storeT) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(buildStoreSelect(storeT) + " FROM " + storeT + " WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1");
            return rows.isEmpty() ? null : rows.get(0);
        } catch (Exception e) {
            log.warn("[admin-store] load store: {}", e.getMessage());
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read store: " + e.getMessage());
        }
    }

    private String buildStoreSelect(String storeT) {
        StringBuilder sel = new StringBuilder("SELECT id::text AS id, name");
        if (schema.hasColumn(storeT, "default_sales_channel_id")) {
            sel.append(", default_sales_channel_id::text AS default_sales_channel_id");
        }
        if (schema.hasColumn(storeT, "default_region_id")) {
            sel.append(", default_region_id::text AS default_region_id");
        }
        if (schema.hasColumn(storeT, "default_location_id")) {
            sel.append(", default_location_id::text AS default_location_id");
        }
        if (schema.hasColumn(storeT, "default_currency_code")) {
            sel.append(", default_currency_code");
        }
        if (schema.hasColumn(storeT, "metadata")) {
            sel.append(", metadata");
        }
        return sel.toString();
    }

    private Map<String, Object> enrichStore(Map<String, Object> row) {
        Map<String, Object> store = new LinkedHashMap<>();
        store.put("id", row.get("id"));
        store.put("name", row.get("name"));
        store.put("default_sales_channel_id", row.get("default_sales_channel_id"));
        store.put("default_region_id", row.get("default_region_id"));
        store.put("default_location_id", row.get("default_location_id"));
        store.put("metadata", readMetadata(row.get("metadata")));

        String scId = stringVal(row.get("default_sales_channel_id"));
        String regId = stringVal(row.get("default_region_id"));
        String locId = stringVal(row.get("default_location_id"));

        store.put("default_sales_channel_name", lookupName(sanitizeTable(props.getSalesChannelTable()), scId));
        store.put("default_region_name", lookupName(sanitizeTable(props.getRegionTable()), regId));
        String locTable = sanitizeTable(props.getStockLocationTable());
        store.put("default_location_name", schema.hasTable(locTable) ? lookupName(locTable, locId) : null);

        String cur = stringVal(row.get("default_currency_code"));
        if (cur == null && regId != null) {
            cur = lookupRegionCurrency(regId);
        }
        store.put("default_currency_code", cur != null ? cur.toLowerCase(Locale.ROOT) : null);
        store.put("default_currency_name", lookupCurrencyName(cur));

        return store;
    }

    private Object readMetadata(Object raw) {
        if (raw == null) {
            return Map.of();
        }
        if (raw instanceof PGobject pg) {
            try {
                String v = pg.getValue();
                if (v == null || v.isBlank()) {
                    return Map.of();
                }
                return objectMapper.readValue(v, Object.class);
            } catch (Exception e) {
                return Map.of();
            }
        }
        return raw;
    }

    private String lookupName(String table, String id) {
        if (id == null || id.isBlank() || !schema.hasTable(table) || !schema.hasColumn(table, "name")) {
            return null;
        }
        try {
            List<String> names = jdbc.query(
                "SELECT name FROM " + table + " WHERE id::text = ? AND deleted_at IS NULL LIMIT 1",
                (rs, i) -> rs.getString("name"),
                id.trim()
            );
            return names.isEmpty() ? null : names.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private String lookupRegionCurrency(String regionId) {
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable) || !schema.hasColumn(rTable, "currency_code")) {
            return null;
        }
        try {
            List<String> codes = jdbc.query(
                "SELECT currency_code FROM " + rTable + " WHERE id::text = ? AND deleted_at IS NULL LIMIT 1",
                (rs, i) -> rs.getString("currency_code"),
                regionId.trim()
            );
            return codes.isEmpty() ? null : codes.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private String lookupCurrencyName(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String cTable = sanitizeTable(props.getCurrencyTable());
        if (!schema.hasTable(cTable) || !schema.hasColumn(cTable, "name") || !schema.hasColumn(cTable, "code")) {
            return null;
        }
        try {
            List<String> names = jdbc.query(
                "SELECT name FROM " + cTable + " WHERE lower(code::text) = lower(?) AND deleted_at IS NULL LIMIT 1",
                (rs, i) -> rs.getString("name"),
                code.trim()
            );
            return names.isEmpty() ? null : names.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> loadOptions() {
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("currencies", listCurrencies());
        options.put("regions", listRegions());
        options.put("sales_channels", listSalesChannels());
        String locTable = sanitizeTable(props.getStockLocationTable());
        options.put("stock_locations", schema.hasTable(locTable) ? listStockLocations(locTable) : List.of());
        return options;
    }

    private List<Map<String, String>> listCurrencies() {
        String cTable = sanitizeTable(props.getCurrencyTable());
        if (schema.hasTable(cTable) && schema.hasColumn(cTable, "code")) {
            try {
                boolean hasName = schema.hasColumn(cTable, "name");
                String sel = hasName
                    ? "SELECT lower(code::text) AS code, name FROM " + cTable + " WHERE deleted_at IS NULL ORDER BY code NULLS LAST LIMIT 500"
                    : "SELECT lower(code::text) AS code FROM " + cTable + " WHERE deleted_at IS NULL ORDER BY code NULLS LAST LIMIT 500";
                return jdbc.query(sel, (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    String code = rs.getString("code");
                    m.put("code", code);
                    m.put("name", hasName ? rs.getString("name") : (code != null ? code.toUpperCase(Locale.ROOT) : ""));
                    return m;
                });
            } catch (Exception e) {
                log.debug("[admin-store] listCurrencies currency table: {}", e.getMessage());
            }
        }
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable) || !schema.hasColumn(rTable, "currency_code")) {
            return List.of();
        }
        try {
            return jdbc.query(
                "SELECT DISTINCT lower(trim(currency_code::text)) AS code FROM " + rTable
                    + " WHERE deleted_at IS NULL AND currency_code IS NOT NULL AND trim(currency_code::text) <> '' ORDER BY 1 LIMIT 200",
                (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    String code = rs.getString("code");
                    m.put("code", code);
                    String nm = lookupCurrencyName(code);
                    m.put("name", nm != null ? nm : (code != null ? code.toUpperCase(Locale.ROOT) : ""));
                    return m;
                }
            );
        } catch (Exception e) {
            log.debug("[admin-store] listCurrencies from regions: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, String>> listRegions() {
        String rTable = sanitizeTable(props.getRegionTable());
        if (!schema.hasTable(rTable)) {
            return List.of();
        }
        boolean hasCur = schema.hasColumn(rTable, "currency_code");
        try {
            String sql = hasCur
                ? "SELECT id::text AS id, name, lower(currency_code::text) AS currency_code FROM " + rTable
                    + " WHERE deleted_at IS NULL ORDER BY name NULLS LAST LIMIT 500"
                : "SELECT id::text AS id, name FROM " + rTable + " WHERE deleted_at IS NULL ORDER BY name NULLS LAST LIMIT 500";
            return jdbc.query(sql, (rs, i) -> {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("id", rs.getString("id"));
                m.put("name", rs.getString("name"));
                m.put("currency_code", hasCur ? rs.getString("currency_code") : null);
                return m;
            });
        } catch (Exception e) {
            log.debug("[admin-store] listRegions: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, String>> listSalesChannels() {
        String st = sanitizeTable(props.getSalesChannelTable());
        if (!schema.hasTable(st)) {
            return List.of();
        }
        try {
            return jdbc.query(
                "SELECT id::text AS id, name FROM " + st + " WHERE deleted_at IS NULL ORDER BY name NULLS LAST LIMIT 500",
                (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("name", rs.getString("name"));
                    return m;
                }
            );
        } catch (Exception e) {
            log.debug("[admin-store] listSalesChannels: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, String>> listStockLocations(String locTable) {
        try {
            return jdbc.query(
                "SELECT id::text AS id, name FROM " + locTable + " WHERE deleted_at IS NULL ORDER BY name NULLS LAST LIMIT 500",
                (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("name", rs.getString("name"));
                    return m;
                }
            );
        } catch (Exception e) {
            log.debug("[admin-store] listStockLocations: {}", e.getMessage());
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

    private static String emptyToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String normalizeCurrency(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim().toLowerCase(Locale.ROOT);
    }

    private static String stringVal(Object o) {
        if (o == null) {
            return null;
        }
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static String sanitizeTable(String name) {
        if (name == null || name.isBlank()) {
            return "store";
        }
        return name.replaceAll("[^a-zA-Z0-9_]", "").toLowerCase(Locale.ROOT);
    }
}
