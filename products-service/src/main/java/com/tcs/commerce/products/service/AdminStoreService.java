package com.tcs.commerce.products.service;

import com.fasterxml.jackson.core.type.TypeReference;
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

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

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
        bootstrapStoreIfEmpty(storeT);
        Map<String, Object> row = loadStoreRow(storeT);
        if (row == null || row.isEmpty()) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "No store row found (store table is empty)");
        }
        Map<String, Object> store = enrichStore(row);
        String storeId = stringVal(row.get("id"));
        Map<String, Object> options = loadOptions(storeId);
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

        // Medusa v2: store-level custom fields live in public.store.metadata (jsonb).
        if (schema.hasColumn(storeT, "metadata") && body.has("metadata") && !body.get("metadata").isNull()) {
            JsonNode metaNode = body.get("metadata");
            if (!metaNode.isObject()) {
                throw new ProductWriteException(HttpStatus.BAD_REQUEST, "metadata must be a JSON object");
            }
            Map<String, Object> metaMap = objectMapper.convertValue(metaNode, new TypeReference<Map<String, Object>>() {});
            try {
                PGobject pg = new PGobject();
                pg.setType("jsonb");
                pg.setValue(objectMapper.writeValueAsString(metaMap));
                sql.append(", metadata = ?");
                args.add(pg);
            } catch (Exception e) {
                throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Invalid metadata: " + e.getMessage());
            }
        }

        sql.append(" WHERE id::text = ?");
        if (schema.hasColumn(storeT, "deleted_at")) {
            sql.append(" AND deleted_at IS NULL");
        }
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
        if (currencyCode != null && !schema.hasColumn(storeT, "default_currency_code")) {
            syncStoreDefaultCurrency(storeId, currencyCode);
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

    private void bootstrapStoreIfEmpty(String storeT) {
        try {
            String alive = schema.hasColumn(storeT, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            Long count = jdbc.queryForObject("SELECT COUNT(*) FROM " + storeT + " WHERE " + alive, Long.class);
            if (count != null && count > 0) {
                return;
            }
            if (!schema.hasColumn(storeT, "id")) {
                return;
            }
            String id = "store_" + UUID.randomUUID().toString().replace("-", "");
            List<String> cols = new ArrayList<>();
            List<Object> vals = new ArrayList<>();
            cols.add("id");
            vals.add(id);
            if (schema.hasColumn(storeT, "name")) {
                cols.add("name");
                vals.add("Medusa Store");
            }
            Timestamp now = new Timestamp(System.currentTimeMillis());
            if (schema.hasColumn(storeT, "created_at")) {
                cols.add("created_at");
                vals.add(now);
            }
            if (schema.hasColumn(storeT, "updated_at")) {
                cols.add("updated_at");
                vals.add(now);
            }
            String placeholders = String.join(", ", Collections.nCopies(cols.size(), "?"));
            jdbc.update("INSERT INTO " + storeT + " (" + String.join(", ", cols) + ") VALUES (" + placeholders + ")", vals.toArray());
            log.info("[admin-store] inserted default store row id={} (table was empty)", id);
        } catch (Exception e) {
            log.warn("[admin-store] bootstrap store: {}", e.getMessage());
        }
    }

    private Map<String, Object> loadStoreRow(String storeT) {
        try {
            String alive = schema.hasColumn(storeT, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            String orderCol = schema.hasColumn(storeT, "created_at") ? "created_at" : "id";
            List<Map<String, Object>> rows = jdbc.queryForList(
                buildStoreSelect(storeT) + " FROM " + storeT + " WHERE " + alive + " ORDER BY " + orderCol + " ASC NULLS LAST LIMIT 1"
            );
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

        String storeId = stringVal(row.get("id"));
        String cur = stringVal(row.get("default_currency_code"));
        if (cur == null && storeId != null) {
            cur = lookupDefaultStoreCurrency(storeId);
        }
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
            String alive = schema.hasColumn(rTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<String> codes = jdbc.query(
                "SELECT currency_code FROM " + rTable + " WHERE id::text = ? AND " + alive + " LIMIT 1",
                (rs, i) -> rs.getString("currency_code"),
                regionId.trim()
            );
            return codes.isEmpty() ? null : codes.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Medusa v2: default currency lives in {@code store_currency.is_default} after {@code default_currency_code} is dropped from {@code store}.
     * Uses the same store_id matching fallbacks as {@link #listStoreCurrenciesTableOnly} (strict → null store_id → any row when single store).
     */
    private String lookupDefaultStoreCurrency(String storeId) {
        String t = sanitizeTable(props.getStoreCurrencyTable());
        if (!schema.hasTable(t) || !schema.hasColumn(t, "store_id") || !schema.hasColumn(t, "currency_code")) {
            return null;
        }
        boolean hasDefault = schema.hasColumn(t, "is_default");
        String alive = schema.hasColumn(t, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            if (hasDefault) {
                String c = queryDefaultCurrencyCodeWithScope(t, alive, storeId, StoreCurrencyScope.STRICT_STORE_ID);
                if (c != null) {
                    return c;
                }
                if (countActiveStores() == 1) {
                    c = queryDefaultCurrencyCodeWithScope(t, alive, storeId, StoreCurrencyScope.INCLUDE_NULL_STORE_ID);
                    if (c != null) {
                        return c;
                    }
                    c = queryDefaultCurrencyCodeWithScope(t, alive, storeId, StoreCurrencyScope.ANY_ROW_SINGLE_STORE);
                    if (c != null) {
                        return c;
                    }
                }
            }
            List<String> fallback = jdbc.query(
                buildStoreCurrencyCodeSelect(t, alive, storeId, StoreCurrencyScope.STRICT_STORE_ID, false)
                    + " ORDER BY created_at ASC NULLS LAST LIMIT 1",
                (rs, i) -> rs.getString("c"),
                storeId.trim()
            );
            if (!fallback.isEmpty() && fallback.get(0) != null) {
                return fallback.get(0);
            }
            if (countActiveStores() == 1) {
                fallback = jdbc.query(
                    buildStoreCurrencyCodeSelect(t, alive, storeId, StoreCurrencyScope.INCLUDE_NULL_STORE_ID, false)
                        + " ORDER BY created_at ASC NULLS LAST LIMIT 1",
                    (rs, i) -> rs.getString("c"),
                    storeId.trim()
                );
                if (!fallback.isEmpty() && fallback.get(0) != null) {
                    return fallback.get(0);
                }
                fallback = jdbc.query(
                    buildStoreCurrencyCodeSelect(t, alive, storeId, StoreCurrencyScope.ANY_ROW_SINGLE_STORE, false)
                        + " ORDER BY created_at ASC NULLS LAST LIMIT 1",
                    (rs, i) -> rs.getString("c")
                );
                return fallback.isEmpty() ? null : fallback.get(0);
            }
            return null;
        } catch (Exception e) {
            log.debug("[admin-store] lookupDefaultStoreCurrency: {}", e.getMessage());
            return null;
        }
    }

    private String queryDefaultCurrencyCodeWithScope(String t, String alive, String storeId, StoreCurrencyScope scope) {
        String sql =
            buildStoreCurrencyCodeSelect(t, alive, storeId, scope, true) + " ORDER BY created_at ASC NULLS LAST LIMIT 1";
        List<String> codes;
        if (scope == StoreCurrencyScope.ANY_ROW_SINGLE_STORE) {
            codes = jdbc.query(sql, (rs, i) -> rs.getString("c"));
        } else {
            codes = jdbc.query(sql, (rs, i) -> rs.getString("c"), storeId.trim());
        }
        return codes.isEmpty() ? null : codes.get(0);
    }

    private String buildStoreCurrencyCodeSelect(
        String t,
        String alive,
        String storeId,
        StoreCurrencyScope scope,
        boolean requireIsDefault
    ) {
        StringBuilder sb = new StringBuilder("SELECT lower(currency_code::text) AS c FROM ").append(t).append(" WHERE ").append(alive);
        if (requireIsDefault && schema.hasColumn(t, "is_default")) {
            sb.append(" AND is_default = true");
        }
        sb.append(" AND ").append(storeIdWhereClause(scope));
        return sb.toString();
    }

    private String storeIdWhereClause(StoreCurrencyScope scope) {
        return switch (scope) {
            case STRICT_STORE_ID -> "store_id::text = ?";
            case INCLUDE_NULL_STORE_ID -> "(store_id::text = ? OR store_id IS NULL)";
            case ANY_ROW_SINGLE_STORE -> "TRUE";
        };
    }

    private String storeIdWhereClauseForAlias(String alias, StoreCurrencyScope scope) {
        return switch (scope) {
            case STRICT_STORE_ID -> alias + ".store_id::text = ?";
            case INCLUDE_NULL_STORE_ID -> "(" + alias + ".store_id::text = ? OR " + alias + ".store_id IS NULL)";
            case ANY_ROW_SINGLE_STORE -> "TRUE";
        };
    }

    private long countActiveStores() {
        String storeT = sanitizeTable(props.getStoreTable());
        if (!schema.hasTable(storeT)) {
            return 0;
        }
        String alive = schema.hasColumn(storeT, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            Long n = jdbc.queryForObject("SELECT COUNT(*) FROM " + storeT + " WHERE " + alive, Long.class);
            return n == null ? 0 : n;
        } catch (Exception e) {
            log.debug("[admin-store] countActiveStores: {}", e.getMessage());
            return 0;
        }
    }

    private enum StoreCurrencyScope {
        /** Match Medusa FK: {@code store_currency.store_id} equals the store row id. */
        STRICT_STORE_ID,
        /** Some DBs have {@code store_id} NULL for the only store’s rows (legacy / migration). */
        INCLUDE_NULL_STORE_ID,
        /** Single-tenant: use every {@code store_currency} row (only when exactly one active {@code store}). */
        ANY_ROW_SINGLE_STORE
    }

    private void syncStoreDefaultCurrency(String storeId, String currencyCode) {
        if (storeId == null || storeId.isBlank() || currencyCode == null || currencyCode.isBlank()) {
            return;
        }
        String t = sanitizeTable(props.getStoreCurrencyTable());
        if (!schema.hasTable(t)
            || !schema.hasColumn(t, "store_id")
            || !schema.hasColumn(t, "currency_code")
            || !schema.hasColumn(t, "is_default")) {
            return;
        }
        String alive = schema.hasColumn(t, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String norm = currencyCode.trim().toLowerCase(Locale.ROOT);
        try {
            jdbc.update(
                "UPDATE " + t + " SET is_default = false, updated_at = NOW() WHERE store_id::text = ? AND " + alive,
                storeId.trim()
            );
            int updated = jdbc.update(
                "UPDATE " + t + " SET is_default = true, updated_at = NOW() WHERE store_id::text = ? AND lower(currency_code::text) = ? AND " + alive,
                storeId.trim(),
                norm
            );
            if (updated == 0 && schema.hasColumn(t, "id")) {
                String newId = "scur_" + UUID.randomUUID().toString().replace("-", "");
                if (schema.hasColumn(t, "created_at") && schema.hasColumn(t, "updated_at")) {
                    jdbc.update(
                        "INSERT INTO " + t + " (id, currency_code, is_default, store_id, created_at, updated_at) VALUES (?, ?, true, ?, NOW(), NOW())",
                        newId,
                        norm,
                        storeId.trim()
                    );
                } else {
                    jdbc.update(
                        "INSERT INTO " + t + " (id, currency_code, is_default, store_id) VALUES (?, ?, true, ?)",
                        newId,
                        norm,
                        storeId.trim()
                    );
                }
            }
        } catch (Exception e) {
            log.warn("[admin-store] syncStoreDefaultCurrency: {}", e.getMessage());
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
            String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            List<String> names = jdbc.query(
                "SELECT name FROM " + cTable + " WHERE lower(code::text) = lower(?) AND " + alive + " LIMIT 1",
                (rs, i) -> rs.getString("name"),
                code.trim()
            );
            return names.isEmpty() ? null : names.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> loadOptions(String storeId) {
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("store_currencies", listStoreCurrenciesTableOnly(storeId));
        options.put("currencies", listCurrencyOptionsForDropdown(storeId));
        options.put("regions", listRegions());
        options.put("sales_channels", listSalesChannels());
        String locTable = sanitizeTable(props.getStockLocationTable());
        options.put("stock_locations", schema.hasTable(locTable) ? listStockLocations(locTable) : List.of());
        return options;
    }

    /**
     * Code + name list for default-currency and other dropdowns (catalog + anything linked to the store).
     */
    private List<Map<String, String>> listCurrencyOptionsForDropdown(String storeId) {
        return mergeCurrencyOptionRows(listCurrencies(), listCurrenciesLinkedToStore(storeId));
    }

    /**
     * Currencies table in admin: only rows configured for this store ({@code store_currency}), never the full catalog.
     * When {@code store_currency} is missing (legacy DB), falls back to at most the store default currency row.
     * Each entry: {@code code}, {@code name}, {@code tax_inclusive_pricing}, optional {@code store_currency_id}.
     */
    private List<Map<String, Object>> listStoreCurrenciesTableOnly(String storeId) {
        String scTable = sanitizeTable(props.getStoreCurrencyTable());
        String cTable = sanitizeTable(props.getCurrencyTable());
        String taxCol = resolveCurrencyTaxColumnForTable(cTable);
        boolean joinableCurrency = schema.hasTable(cTable) && schema.hasColumn(cTable, "code");
        if (schema.hasTable(scTable)
            && storeId != null
            && !storeId.isBlank()
            && schema.hasColumn(scTable, "store_id")
            && schema.hasColumn(scTable, "currency_code")) {
            List<Map<String, Object>> rows =
                queryStoreCurrenciesDetailed(scTable, cTable, joinableCurrency, taxCol, storeId, StoreCurrencyScope.STRICT_STORE_ID);
            if (rows.isEmpty() && countActiveStores() == 1) {
                rows = queryStoreCurrenciesDetailed(
                    scTable,
                    cTable,
                    joinableCurrency,
                    taxCol,
                    storeId,
                    StoreCurrencyScope.INCLUDE_NULL_STORE_ID
                );
            }
            if (rows.isEmpty() && countActiveStores() == 1) {
                rows = queryStoreCurrenciesDetailed(
                    scTable,
                    cTable,
                    joinableCurrency,
                    taxCol,
                    storeId,
                    StoreCurrencyScope.ANY_ROW_SINGLE_STORE
                );
            }
            if (!rows.isEmpty()) {
                return rows;
            }
            log.debug(
                "[admin-store] store_currency: no rows for store id {} (strict / null-store_id / single-tenant fallbacks); trying legacy default",
                storeId
            );
        }
        return legacyDefaultCurrencyOnlyRows(storeId, cTable, taxCol, joinableCurrency);
    }

    private List<Map<String, Object>> legacyDefaultCurrencyOnlyRows(
        String storeId,
        String cTable,
        String taxCol,
        boolean joinableCurrency
    ) {
        String storeT = sanitizeTable(props.getStoreTable());
        if (!schema.hasTable(storeT)) {
            return List.of();
        }
        Map<String, Object> srow = loadStoreRow(storeT);
        if (srow == null) {
            return List.of();
        }
        String defCur = stringVal(srow.get("default_currency_code"));
        if (defCur == null && storeId != null && !storeId.isBlank()) {
            defCur = lookupDefaultStoreCurrency(storeId);
        }
        if (defCur == null || defCur.isBlank()) {
            return List.of();
        }
        String codeLower = defCur.trim().toLowerCase(Locale.ROOT);
        String nm = lookupCurrencyName(codeLower);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("store_currency_id", null);
        m.put("code", codeLower);
        m.put("name", nm != null ? nm : codeLower.toUpperCase(Locale.ROOT));
        m.put(
            "tax_inclusive_pricing",
            resolveTaxInclusiveForCurrencyCode(codeLower, cTable, taxCol, joinableCurrency)
        );
        return List.of(m);
    }

    /**
     * Medusa v2 persists per-store currency tax-inclusive in pricing {@code price_preference}
     * ({@code attribute='currency_code'}, {@code value} = code), not on {@code currency}.
     * Prefer that row when present; otherwise fall back to {@code currency} columns.
     */
    private boolean resolveTaxInclusiveForCurrencyCode(
        String codeLower,
        String cTable,
        String taxCol,
        boolean joinableCurrency
    ) {
        Boolean fromPreference = readPricePreferenceTaxInclusive(codeLower);
        if (fromPreference != null) {
            return Boolean.TRUE.equals(fromPreference);
        }
        return joinableCurrency && taxCol != null && readCurrencyTaxFlag(cTable, taxCol, codeLower);
    }

    /**
     * @return {@code null} if table missing, no row, or error; otherwise DB value
     */
    private Boolean readPricePreferenceTaxInclusive(String currencyCodeLower) {
        if (currencyCodeLower == null || currencyCodeLower.isBlank() || !canUsePricePreferenceTable()) {
            return null;
        }
        String ppTable = pricePreferenceTable();
        String del = schema.hasColumn(ppTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            return jdbc.queryForObject(
                "SELECT is_tax_inclusive FROM "
                    + ppTable
                    + " WHERE attribute = 'currency_code' AND lower(trim(value::text)) = lower(?) AND "
                    + del
                    + " LIMIT 1",
                Boolean.class,
                currencyCodeLower.trim()
            );
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            return null;
        } catch (Exception e) {
            log.debug("[admin-store] readPricePreferenceTaxInclusive: {}", e.getMessage());
            return null;
        }
    }

    private boolean canUsePricePreferenceTable() {
        String t = pricePreferenceTable();
        return schema.hasTable(t)
            && schema.hasColumn(t, "id")
            && schema.hasColumn(t, "attribute")
            && schema.hasColumn(t, "value")
            && schema.hasColumn(t, "is_tax_inclusive");
    }

    private static String pricePreferenceTable() {
        return "price_preference";
    }

    /**
     * SQL expression for tax-inclusive display: Medusa v2 {@code price_preference} overrides {@code currency}.* when joined.
     */
    private String buildTaxFlagSelectSql(boolean usePp, String cTable, String taxCol, boolean joinCurrency) {
        if (usePp && joinCurrency && taxCol != null) {
            return "CASE WHEN pp.id IS NOT NULL THEN (pp.is_tax_inclusive IS TRUE) ELSE (c."
                + taxCol
                + " IS TRUE) END";
        }
        if (usePp && joinCurrency) {
            return "CASE WHEN pp.id IS NOT NULL THEN (pp.is_tax_inclusive IS TRUE) ELSE false END";
        }
        if (usePp) {
            return "CASE WHEN pp.id IS NOT NULL THEN (pp.is_tax_inclusive IS TRUE) ELSE false END";
        }
        if (joinCurrency && taxCol != null) {
            return "(c." + taxCol + " IS TRUE)";
        }
        return "false";
    }

    private List<Map<String, Object>> queryStoreCurrenciesDetailed(
        String scTable,
        String cTable,
        boolean joinCurrency,
        String taxCol,
        String storeId,
        StoreCurrencyScope scope
    ) {
        String scAlive = schema.hasColumn(scTable, "deleted_at") ? "sc.deleted_at IS NULL" : "TRUE";
        boolean usePp = canUsePricePreferenceTable();
        String ppTable = pricePreferenceTable();
        String ppAlive = usePp && schema.hasColumn(ppTable, "deleted_at") ? "pp.deleted_at IS NULL" : "TRUE";
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT sc.id::text AS store_currency_id, lower(trim(sc.currency_code::text)) AS code ");
        if (joinCurrency) {
            String cDel = schema.hasColumn(cTable, "deleted_at") ? " AND (c.code IS NULL OR c.deleted_at IS NULL)" : "";
            sql.append(", COALESCE(NULLIF(trim(c.name::text), ''), upper(trim(sc.currency_code::text))) AS name ");
            sql.append(", ").append(buildTaxFlagSelectSql(usePp, cTable, taxCol, joinCurrency)).append(" AS tax_flag ");
            sql.append(" FROM ").append(scTable).append(" sc ");
            if (usePp) {
                sql.append(" LEFT JOIN ")
                    .append(ppTable)
                    .append(
                        " pp ON pp.attribute = 'currency_code' AND lower(trim(pp.value::text)) = lower(trim(sc.currency_code::text)) AND "
                    )
                    .append(ppAlive);
            }
            sql.append(" LEFT JOIN ").append(cTable).append(" c ON lower(trim(c.code::text)) = lower(trim(sc.currency_code::text))");
            sql.append(cDel);
        } else {
            sql.append(", upper(trim(sc.currency_code::text)) AS name, ");
            sql.append(buildTaxFlagSelectSql(usePp, cTable, taxCol, false)).append(" AS tax_flag ");
            sql.append(" FROM ").append(scTable).append(" sc ");
            if (usePp) {
                sql.append(" LEFT JOIN ")
                    .append(ppTable)
                    .append(
                        " pp ON pp.attribute = 'currency_code' AND lower(trim(pp.value::text)) = lower(trim(sc.currency_code::text)) AND "
                    )
                    .append(ppAlive);
            }
        }
        sql.append(" WHERE ").append(scAlive);
        sql.append(" AND (").append(storeIdWhereClauseForAlias("sc", scope)).append(")");
        if (schema.hasColumn(scTable, "is_default")) {
            sql.append(" ORDER BY sc.is_default DESC NULLS LAST, lower(trim(sc.currency_code::text))");
        } else {
            sql.append(" ORDER BY lower(trim(sc.currency_code::text))");
        }
        try {
            if (scope == StoreCurrencyScope.ANY_ROW_SINGLE_STORE) {
                return jdbc.query(sql.toString(), (rs, i) -> mapStoreCurrencyRow(rs));
            }
            return jdbc.query(sql.toString(), (rs, i) -> mapStoreCurrencyRow(rs), storeId.trim());
        } catch (Exception e) {
            log.warn("[admin-store] queryStoreCurrenciesDetailed scope={}: {}", scope, e.getMessage());
            return List.of();
        }
    }

    private static Map<String, Object> mapStoreCurrencyRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("store_currency_id", rs.getString("store_currency_id"));
        String code = rs.getString("code");
        m.put("code", code != null ? code.toLowerCase(Locale.ROOT) : null);
        m.put("name", rs.getString("name"));
        m.put("tax_inclusive_pricing", rs.getBoolean("tax_flag"));
        return m;
    }

    private boolean readCurrencyTaxFlag(String cTable, String taxCol, String code) {
        if (code == null || taxCol == null || !schema.hasTable(cTable)) {
            return false;
        }
        String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            Boolean b = jdbc.queryForObject(
                "SELECT (" + taxCol + " IS TRUE) FROM " + cTable + " WHERE lower(code::text) = lower(?) AND " + alive + " LIMIT 1",
                Boolean.class,
                code.trim()
            );
            return Boolean.TRUE.equals(b);
        } catch (Exception e) {
            return false;
        }
    }

    private String resolveCurrencyTaxColumnForTable(String cTable) {
        if (!schema.hasTable(cTable)) {
            return null;
        }
        if (schema.hasColumn(cTable, "tax_inclusive_pricing")) {
            return "tax_inclusive_pricing";
        }
        if (schema.hasColumn(cTable, "includes_tax")) {
            return "includes_tax";
        }
        return null;
    }

    /** First active store id (for admin currency link removal). */
    public String getDefaultStoreId() {
        String storeT = sanitizeTable(props.getStoreTable());
        if (!schema.hasTable(storeT)) {
            return null;
        }
        try {
            bootstrapStoreIfEmpty(storeT);
            Map<String, Object> row = loadStoreRow(storeT);
            return row == null ? null : stringVal(row.get("id"));
        } catch (Exception e) {
            log.debug("[admin-store] getDefaultStoreId: {}", e.getMessage());
            return null;
        }
    }

    /** Adds ISO codes present on {@code store_currency} so the admin picker matches Medusa-supported currencies for this store. */
    private List<Map<String, String>> listCurrenciesLinkedToStore(String storeId) {
        if (storeId == null || storeId.isBlank()) {
            return List.of();
        }
        String t = sanitizeTable(props.getStoreCurrencyTable());
        if (!schema.hasTable(t) || !schema.hasColumn(t, "store_id") || !schema.hasColumn(t, "currency_code")) {
            return List.of();
        }
        String alive = schema.hasColumn(t, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        try {
            List<Map<String, String>> rows = queryLinkedCurrencyOptionRows(t, alive, storeId, StoreCurrencyScope.STRICT_STORE_ID);
            if (rows.isEmpty() && countActiveStores() == 1) {
                rows = queryLinkedCurrencyOptionRows(t, alive, storeId, StoreCurrencyScope.INCLUDE_NULL_STORE_ID);
            }
            if (rows.isEmpty() && countActiveStores() == 1) {
                rows = queryLinkedCurrencyOptionRows(t, alive, storeId, StoreCurrencyScope.ANY_ROW_SINGLE_STORE);
            }
            return rows;
        } catch (Exception e) {
            log.debug("[admin-store] listCurrenciesLinkedToStore: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, String>> queryLinkedCurrencyOptionRows(
        String t,
        String alive,
        String storeId,
        StoreCurrencyScope scope
    ) {
        String sql =
            "SELECT DISTINCT lower(currency_code::text) AS code FROM "
                + t
                + " WHERE "
                + alive
                + " AND ("
                + storeIdWhereClause(scope)
                + ") ORDER BY 1 LIMIT 200";
        if (scope == StoreCurrencyScope.ANY_ROW_SINGLE_STORE) {
            return jdbc.query(sql, (rs, i) -> mapLinkedCurrencyRow(rs));
        }
        return jdbc.query(sql, (rs, i) -> mapLinkedCurrencyRow(rs), storeId.trim());
    }

    private Map<String, String> mapLinkedCurrencyRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, String> m = new LinkedHashMap<>();
        String code = rs.getString("code");
        m.put("code", code);
        String nm = lookupCurrencyName(code);
        m.put("name", nm != null ? nm : (code != null ? code.toUpperCase(Locale.ROOT) : ""));
        return m;
    }

    private static List<Map<String, String>> mergeCurrencyOptionRows(
        List<Map<String, String>> primary,
        List<Map<String, String>> extra
    ) {
        if (extra == null || extra.isEmpty()) {
            return primary;
        }
        Map<String, Map<String, String>> byCode = new LinkedHashMap<>();
        for (Map<String, String> row : primary) {
            if (row == null) {
                continue;
            }
            String c = row.get("code");
            if (c == null) {
                continue;
            }
            byCode.put(c.toLowerCase(Locale.ROOT), new LinkedHashMap<>(row));
        }
        for (Map<String, String> row : extra) {
            if (row == null) {
                continue;
            }
            String c = row.get("code");
            if (c == null) {
                continue;
            }
            String key = c.toLowerCase(Locale.ROOT);
            byCode.putIfAbsent(key, new LinkedHashMap<>(row));
        }
        return new ArrayList<>(byCode.values());
    }

    private List<Map<String, String>> listCurrencies() {
        String cTable = sanitizeTable(props.getCurrencyTable());
        if (schema.hasTable(cTable) && schema.hasColumn(cTable, "code")) {
            try {
                boolean hasName = schema.hasColumn(cTable, "name");
                String cAlive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
                String sel = hasName
                    ? "SELECT lower(code::text) AS code, name FROM " + cTable + " WHERE " + cAlive + " ORDER BY code NULLS LAST LIMIT 500"
                    : "SELECT lower(code::text) AS code FROM " + cTable + " WHERE " + cAlive + " ORDER BY code NULLS LAST LIMIT 500";
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
