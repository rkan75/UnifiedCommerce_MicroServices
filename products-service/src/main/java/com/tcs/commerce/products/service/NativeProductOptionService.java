package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import com.tcs.commerce.products.web.ProductOptionDto;
import com.tcs.commerce.products.web.ProductVariantDto;
import com.tcs.commerce.products.web.VariantOptionDto;
import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Catalog {@code product_option}, {@code product_option_value}, and pivot {@code product_variant_option}
 * ({@code variant_id}, {@code option_value_id}).
 * <p>
 * When these tables exist, admin option updates use this schema instead of {@code metadata.admin_product_options}.
 */
@Service
public class NativeProductOptionService {

    private static final Logger log = LoggerFactory.getLogger(NativeProductOptionService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final CatalogSchemaCache schema;
    private final ObjectMapper objectMapper;

    public NativeProductOptionService(
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

    public boolean nativeTablesPresent() {
        String opt = sanitizeTable(props.getProductOptionTable());
        String vtbl = sanitizeTable(props.getProductOptionValueTable());
        String pivot = sanitizeTable(props.getProductVariantOptionTable());
        if (opt.isBlank() || vtbl.isBlank() || pivot.isBlank()) {
            return false;
        }
        return schema.hasTable(opt)
            && schema.hasColumn(opt, "product_id")
            && schema.hasTable(vtbl)
            && schema.hasColumn(vtbl, "option_id")
            && schema.hasTable(pivot)
            && schema.hasColumn(pivot, "variant_id")
            && schema.hasColumn(pivot, "option_value_id");
    }

    /** Options for the product, ordered by creation. */
    public List<ProductOptionDto> loadProductOptions(String productId) {
        if (productId == null || productId.isBlank() || !nativeTablesPresent()) {
            return List.of();
        }
        String optTable = sanitizeTable(props.getProductOptionTable());
        String valTable = sanitizeTable(props.getProductOptionValueTable());
        List<Map<String, Object>> optionRows;
        try {
            optionRows = jdbc.queryForList(
                "SELECT id, title FROM " + optTable + " WHERE product_id = ? AND deleted_at IS NULL ORDER BY created_at ASC NULLS LAST, id",
                productId.trim()
            );
        } catch (Exception e) {
            log.debug("[product-options] load options: {}", e.getMessage());
            return List.of();
        }
        List<ProductOptionDto> out = new ArrayList<>();
        for (Map<String, Object> orow : optionRows) {
            String oid = str(orow.get("id"));
            String title = str(orow.get("title"));
            if (oid == null || oid.isBlank()) {
                continue;
            }
            List<String> vals = new ArrayList<>();
            try {
                List<Map<String, Object>> vrows = jdbc.queryForList(
                    "SELECT value FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL ORDER BY created_at ASC NULLS LAST, id",
                    oid
                );
                for (Map<String, Object> vr : vrows) {
                    String v = str(vr.get("value"));
                    if (v != null && !v.isBlank()) {
                        vals.add(v.trim());
                    }
                }
            } catch (Exception e) {
                log.debug("[product-options] load values for {}: {}", oid, e.getMessage());
            }
            out.add(new ProductOptionDto(oid, title != null ? title : oid, vals.isEmpty() ? List.of() : List.copyOf(vals)));
        }
        return out;
    }

    /**
     * variantId → (product_option.id → display value text).
     */
    public Map<String, Map<String, String>> loadVariantOptionMatrix(Collection<String> variantIds) {
        if (!nativeTablesPresent() || variantIds == null || variantIds.isEmpty()) {
            return Map.of();
        }
        String pivot = sanitizeTable(props.getProductVariantOptionTable());
        String valTable = sanitizeTable(props.getProductOptionValueTable());
        String optTable = sanitizeTable(props.getProductOptionTable());
        Set<String> idSet =
            variantIds.stream().filter(s -> s != null && !s.isBlank()).map(String::trim).collect(Collectors.toCollection(LinkedHashSet::new));
        if (idSet.isEmpty()) {
            return Map.of();
        }
        String inList = idSet.stream().map(i -> "?").collect(Collectors.joining(", "));
        List<Object> args = new ArrayList<>(idSet);
        String pvoAlive = schema.hasColumn(pivot, "deleted_at") ? " AND pvo.deleted_at IS NULL" : "";
        String sql =
            "SELECT pvo.variant_id::text AS variant_id, po.id::text AS option_id, pov.value::text AS value "
                + "FROM " + pivot + " pvo "
                + "INNER JOIN " + valTable + " pov ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL "
                + "INNER JOIN " + optTable + " po ON po.id = pov.option_id AND po.deleted_at IS NULL "
                + "WHERE pvo.variant_id IN (" + inList + ")" + pvoAlive;
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
            Map<String, Map<String, String>> matrix = new LinkedHashMap<>();
            for (Map<String, Object> r : rows) {
                String vid = str(r.get("variant_id"));
                String oid = str(r.get("option_id"));
                String val = str(r.get("value"));
                if (vid == null || oid == null) {
                    continue;
                }
                matrix.computeIfAbsent(vid, k -> new LinkedHashMap<>()).put(oid, val != null ? val : "");
            }
            return matrix;
        } catch (Exception e) {
            log.debug("[product-options] load variant matrix: {}", e.getMessage());
            return Map.of();
        }
    }

    public ProductVariantDto attachVariantOptions(
        ProductVariantDto v,
        List<ProductOptionDto> productOptions,
        Map<String, Map<String, String>> variantOptionMatrix
    ) {
        if (productOptions == null || productOptions.isEmpty()) {
            return v;
        }
        Map<String, String> row = variantOptionMatrix != null ? variantOptionMatrix.getOrDefault(v.id(), Map.of()) : Map.of();
        List<VariantOptionDto> opts = new ArrayList<>();
        for (ProductOptionDto po : productOptions) {
            String oid = po.id();
            if (oid == null || oid.isBlank()) {
                continue;
            }
            String display = row.get(oid);
            if (display == null || display.isBlank()) {
                display = matchTitleToValues(v.title(), po.values());
            }
            if (display == null || display.isBlank()) {
                display = "—";
            }
            opts.add(new VariantOptionDto(oid, display));
        }
        return new ProductVariantDto(
            v.id(),
            v.title(),
            v.sku(),
            v.thumbnail(),
            v.calculated_price(),
            opts,
            v.manage_inventory(),
            v.allow_backorder(),
            v.inventory_quantity(),
            v.metadata(),
            v.created_at(),
            v.updated_at()
        );
    }

    private static String matchTitleToValues(String variantTitle, List<String> optionValues) {
        if (variantTitle == null || optionValues == null) {
            return "";
        }
        String t = variantTitle.trim();
        for (String val : optionValues) {
            if (val != null && t.equalsIgnoreCase(val.trim())) {
                return val.trim();
            }
        }
        return "";
    }

    /**
     * Admin PATCH body {@code admin_options}: same shape as legacy metadata. Reconciles native rows:
     * honors {@code id} on each option when it belongs to the product (updates title), matches existing rows by title
     * otherwise, adds/removes {@code product_option_value} rows to match {@code values}, soft-deletes options
     * absent from the payload, then re-links variants when {@code variant.title} equals a value.
     */
    @Transactional
    public void syncAdminOptionsToNativeTables(String productId, JsonNode adminOptionsArray) {
        if (productId == null || productId.isBlank() || !nativeTablesPresent()) {
            return;
        }
        if (adminOptionsArray == null || !adminOptionsArray.isArray()) {
            return;
        }
        String productIdTrim = productId.trim();
        String optTable = sanitizeTable(props.getProductOptionTable());
        String valTable = sanitizeTable(props.getProductOptionValueTable());
        String pivotTable = sanitizeTable(props.getProductVariantOptionTable());
        Timestamp now = Timestamp.from(Instant.now());
        LinkedHashSet<String> retainedOptionIds = new LinkedHashSet<>();

        for (JsonNode node : adminOptionsArray) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String title = text(node.get("title"));
            if (title == null || title.isBlank()) {
                continue;
            }
            String optionId = ensureOptionRowForAdminNode(optTable, productIdTrim, node, title.trim(), now);
            if (optionId == null || optionId.isBlank()) {
                continue;
            }
            retainedOptionIds.add(optionId);

            List<String> values = new ArrayList<>();
            JsonNode va = node.get("values");
            if (va != null && va.isArray()) {
                for (JsonNode vn : va) {
                    if (vn != null && vn.isTextual()) {
                        String s = vn.asText().trim();
                        if (!s.isEmpty()) {
                            values.add(s);
                        }
                    }
                }
            }
            reconcileOptionValues(valTable, pivotTable, optionId, values, now);
        }

        softDeleteOptionsNotIn(optTable, valTable, pivotTable, productIdTrim, retainedOptionIds, now);

        try {
            autoLinkVariantsToValues(productIdTrim, pivotTable, optTable, valTable, now);
        } catch (Exception e) {
            log.warn("[product-options] auto-link variants: {}", e.getMessage());
        }

        clearLegacyAdminOptionsMetadata(productIdTrim);
    }

    private String ensureOptionRowForAdminNode(
        String optTable,
        String productId,
        JsonNode node,
        String title,
        Timestamp now
    ) {
        String explicitId = text(node.get("id"));
        if (explicitId != null) {
            explicitId = explicitId.trim();
        }
        if (explicitId != null && !explicitId.isBlank() && optionBelongsToProduct(optTable, explicitId, productId)) {
            updateOptionTitleIfChanged(optTable, explicitId, productId, title, now);
            return explicitId;
        }
        String byTitle = findOptionIdByTitle(optTable, productId, title);
        if (byTitle != null) {
            updateOptionTitleIfChanged(optTable, byTitle, productId, title, now);
            return byTitle;
        }
        String newId = (explicitId != null && !explicitId.isBlank() && !optionIdExistsAnywhere(optTable, explicitId))
            ? explicitId
            : newOptId();
        insertOptionRow(optTable, newId, productId, title, now);
        return newId;
    }

    private boolean optionBelongsToProduct(String optTable, String optionId, String productId) {
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + optTable + " WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                Integer.class,
                optionId,
                productId
            );
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean optionIdExistsAnywhere(String optTable, String id) {
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + optTable + " WHERE id = ? AND deleted_at IS NULL",
                Integer.class,
                id
            );
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private String findOptionIdByTitle(String optTable, String productId, String title) {
        try {
            List<String> existing = jdbc.query(
                "SELECT id::text FROM " + optTable + " WHERE product_id = ? AND deleted_at IS NULL AND LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1",
                (rs, i) -> rs.getString(1),
                productId,
                title
            );
            return existing.isEmpty() ? null : existing.get(0);
        } catch (Exception e) {
            log.debug("[product-options] find option by title: {}", e.getMessage());
            return null;
        }
    }

    private void updateOptionTitleIfChanged(String optTable, String optionId, String productId, String title, Timestamp now) {
        try {
            String cur = jdbc.query(
                "SELECT title::text FROM " + optTable + " WHERE id = ? AND product_id = ? AND deleted_at IS NULL LIMIT 1",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return rs.getString(1);
                },
                optionId,
                productId
            );
            if (cur != null && title.equals(cur.trim())) {
                return;
            }
            if (schema.hasColumn(optTable, "updated_at")) {
                jdbc.update(
                    "UPDATE " + optTable + " SET title = ?, updated_at = ? WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                    title,
                    now,
                    optionId,
                    productId
                );
            } else {
                jdbc.update(
                    "UPDATE " + optTable + " SET title = ? WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                    title,
                    optionId,
                    productId
                );
            }
        } catch (Exception e) {
            log.debug("[product-options] update option title: {}", e.getMessage());
        }
    }

    private void insertOptionRow(String optTable, String id, String productId, String title, Timestamp now) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        putIfColumn(optTable, row, "id", id);
        putIfColumn(optTable, row, "title", title);
        putIfColumn(optTable, row, "product_id", productId);
        putIfColumn(optTable, row, "metadata", emptyJsonObjectIfJsonbColumn(optTable, "metadata"));
        putIfColumn(optTable, row, "created_at", now);
        putIfColumn(optTable, row, "updated_at", now);
        putIfColumn(optTable, row, "deleted_at", null);
        insertDynamic(optTable, row);
    }

    private void reconcileOptionValues(
        String valTable,
        String pivotTable,
        String optionId,
        List<String> desiredRaw,
        Timestamp now
    ) {
        LinkedHashSet<String> desiredLower = new LinkedHashSet<>();
        List<String> desiredOrdered = new ArrayList<>();
        for (String v : desiredRaw) {
            if (v == null) {
                continue;
            }
            String t = v.trim();
            if (t.isEmpty()) {
                continue;
            }
            String lk = t.toLowerCase(Locale.ROOT);
            if (desiredLower.add(lk)) {
                desiredOrdered.add(t);
            }
        }

        List<Map<String, Object>> existing;
        try {
            existing = jdbc.queryForList(
                "SELECT id::text AS id, value::text AS value FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL",
                optionId
            );
        } catch (Exception e) {
            log.debug("[product-options] list values: {}", e.getMessage());
            return;
        }

        for (Map<String, Object> erow : existing) {
            String vid = str(erow.get("id"));
            String valStr = str(erow.get("value"));
            if (vid == null || valStr == null) {
                continue;
            }
            if (!desiredLower.contains(valStr.trim().toLowerCase(Locale.ROOT))) {
                softDeleteValueAndPivots(valTable, pivotTable, vid, now);
            }
        }

        for (String want : desiredOrdered) {
            try {
                Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL AND LOWER(TRIM(value)) = LOWER(TRIM(?))",
                    Integer.class,
                    optionId,
                    want
                );
                if (n != null && n > 0) {
                    continue;
                }
            } catch (Exception ex) {
                log.debug("[product-options] value exists check: {}", ex.getMessage());
            }
            resolveOrCreateValueRow(valTable, optionId, want, now);
        }
    }

    private void softDeleteValueAndPivots(String valTable, String pivotTable, String valueId, Timestamp now) {
        try {
            if (schema.hasColumn(pivotTable, "deleted_at")) {
                jdbc.update(
                    "UPDATE " + pivotTable + " SET deleted_at = ? WHERE option_value_id = ? AND (deleted_at IS NULL)",
                    now,
                    valueId
                );
            } else {
                jdbc.update("DELETE FROM " + pivotTable + " WHERE option_value_id = ?", valueId);
            }
        } catch (Exception e) {
            log.debug("[product-options] pivot remove: {}", e.getMessage());
        }
        try {
            if (schema.hasColumn(valTable, "deleted_at")) {
                if (schema.hasColumn(valTable, "updated_at")) {
                    jdbc.update(
                        "UPDATE " + valTable + " SET deleted_at = ?, updated_at = ? WHERE id = ? AND (deleted_at IS NULL)",
                        now,
                        now,
                        valueId
                    );
                } else {
                    jdbc.update("UPDATE " + valTable + " SET deleted_at = ? WHERE id = ? AND (deleted_at IS NULL)", now, valueId);
                }
            } else {
                jdbc.update("DELETE FROM " + valTable + " WHERE id = ?", valueId);
            }
        } catch (Exception e) {
            log.debug("[product-options] soft delete value: {}", e.getMessage());
        }
    }

    private void softDeleteOptionsNotIn(
        String optTable,
        String valTable,
        String pivotTable,
        String productId,
        Set<String> keepIds,
        Timestamp now
    ) {
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList(
                "SELECT id::text AS id FROM " + optTable + " WHERE product_id = ? AND deleted_at IS NULL",
                productId
            );
        } catch (Exception e) {
            return;
        }
        for (Map<String, Object> row : rows) {
            String oid = str(row.get("id"));
            if (oid == null || keepIds.contains(oid)) {
                continue;
            }
            cascadeSoftDeleteOption(optTable, valTable, pivotTable, oid, now);
        }
    }

    private void cascadeSoftDeleteOption(String optTable, String valTable, String pivotTable, String optionId, Timestamp now) {
        List<String> valueIds;
        try {
            valueIds = jdbc.query(
                "SELECT id::text FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL",
                (rs, i) -> rs.getString(1),
                optionId
            );
        } catch (Exception e) {
            valueIds = List.of();
        }
        for (String vid : valueIds) {
            softDeleteValueAndPivots(valTable, pivotTable, vid, now);
        }
        try {
            if (schema.hasColumn(optTable, "deleted_at")) {
                if (schema.hasColumn(optTable, "updated_at")) {
                    jdbc.update(
                        "UPDATE " + optTable + " SET deleted_at = ?, updated_at = ? WHERE id = ? AND (deleted_at IS NULL)",
                        now,
                        now,
                        optionId
                    );
                } else {
                    jdbc.update("UPDATE " + optTable + " SET deleted_at = ? WHERE id = ? AND (deleted_at IS NULL)", now, optionId);
                }
            } else {
                jdbc.update("DELETE FROM " + optTable + " WHERE id = ?", optionId);
            }
        } catch (Exception e) {
            log.debug("[product-options] soft delete option: {}", e.getMessage());
        }
    }

    private Object emptyJsonObjectIfJsonbColumn(String table, String col) {
        if (!schema.hasColumn(table, col) || !schema.columnIsJsonb(table, col)) {
            return null;
        }
        try {
            PGobject pg = new PGobject();
            pg.setType("jsonb");
            pg.setValue("{}");
            return pg;
        } catch (Exception e) {
            return null;
        }
    }

    private void resolveOrCreateValueRow(String valTable, String optionId, String value, Timestamp now) {
        try {
            List<String> existing = jdbc.query(
                "SELECT id::text FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL AND LOWER(TRIM(value)) = LOWER(TRIM(?)) LIMIT 1",
                (rs, i) -> rs.getString(1),
                optionId,
                value
            );
            if (!existing.isEmpty()) {
                return;
            }
        } catch (Exception e) {
            log.debug("[product-options] find value: {}", e.getMessage());
        }
        String newId = newOptValId();
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        putIfColumn(valTable, row, "id", newId);
        putIfColumn(valTable, row, "value", value);
        putIfColumn(valTable, row, "option_id", optionId);
        putIfColumn(valTable, row, "metadata", emptyJsonObjectIfJsonbColumn(valTable, "metadata"));
        putIfColumn(valTable, row, "created_at", now);
        putIfColumn(valTable, row, "updated_at", now);
        putIfColumn(valTable, row, "deleted_at", null);
        insertDynamic(valTable, row);
    }

    private void autoLinkVariantsToValues(
        String productId,
        String pivotTable,
        String optTable,
        String valTable,
        Timestamp now
    ) {
        String vtbl = sanitizeTable(props.getVariantTable());
        List<Map<String, Object>> variants;
        try {
            variants = jdbc.queryForList(
                "SELECT id::text AS id, title::text AS title FROM " + vtbl + " WHERE product_id = ? AND deleted_at IS NULL",
                productId
            );
        } catch (Exception e) {
            return;
        }
        List<Map<String, Object>> optValues;
        try {
            optValues = jdbc.queryForList(
                "SELECT pov.id::text AS value_id, pov.value::text AS value, po.id::text AS option_id "
                    + "FROM " + valTable + " pov INNER JOIN " + optTable + " po ON po.id = pov.option_id "
                    + "WHERE po.product_id = ? AND pov.deleted_at IS NULL AND po.deleted_at IS NULL",
                productId
            );
        } catch (Exception e) {
            return;
        }
        for (Map<String, Object> vrow : variants) {
            String vid = str(vrow.get("id"));
            String vtitle = str(vrow.get("title"));
            if (vid == null || vtitle == null) {
                continue;
            }
            String vt = vtitle.trim();
            for (Map<String, Object> ov : optValues) {
                String valueId = str(ov.get("value_id"));
                String valStr = str(ov.get("value"));
                if (valueId == null || valStr == null) {
                    continue;
                }
                if (vt.equalsIgnoreCase(valStr.trim())) {
                    insertPivotIfAbsent(pivotTable, vid, valueId, now);
                }
            }
        }
    }

    private void insertPivotIfAbsent(String pivotTable, String variantId, String optionValueId, Timestamp now) {
        try {
            if (schema.hasColumn(pivotTable, "deleted_at")) {
                String reviveSql = "UPDATE " + pivotTable + " SET deleted_at = NULL";
                if (schema.hasColumn(pivotTable, "updated_at")) {
                    reviveSql += ", updated_at = ?";
                }
                reviveSql += " WHERE variant_id = ? AND option_value_id = ? AND deleted_at IS NOT NULL";
                int revived;
                if (schema.hasColumn(pivotTable, "updated_at")) {
                    revived = jdbc.update(reviveSql, now, variantId, optionValueId);
                } else {
                    revived = jdbc.update(
                        "UPDATE " + pivotTable + " SET deleted_at = NULL WHERE variant_id = ? AND option_value_id = ? AND deleted_at IS NOT NULL",
                        variantId,
                        optionValueId
                    );
                }
                if (revived > 0) {
                    return;
                }
            }
        } catch (Exception e0) {
            log.debug("[product-options] pivot revive: {}", e0.getMessage());
        }
        try {
            String pivotSql =
                "SELECT COUNT(*) FROM " + pivotTable + " WHERE variant_id = ? AND option_value_id = ?"
                    + (schema.hasColumn(pivotTable, "deleted_at") ? " AND deleted_at IS NULL" : "");
            Integer n2 = jdbc.queryForObject(
                pivotSql,
                Integer.class,
                variantId,
                optionValueId
            );
            if (n2 != null && n2 > 0) {
                return;
            }
        } catch (Exception e2) {
            log.debug("[product-options] pivot exists check: {}", e2.getMessage());
        }
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        if (schema.hasColumn(pivotTable, "id")) {
            putIfColumn(pivotTable, row, "id", UUID.randomUUID().toString());
        }
        putIfColumn(pivotTable, row, "variant_id", variantId);
        putIfColumn(pivotTable, row, "option_value_id", optionValueId);
        putIfColumn(pivotTable, row, "created_at", now);
        putIfColumn(pivotTable, row, "updated_at", now);
        putIfColumn(pivotTable, row, "deleted_at", null);
        try {
            insertDynamic(pivotTable, row);
        } catch (Exception ex) {
            log.debug("[product-options] pivot insert skipped: {}", ex.getMessage());
        }
    }

    public void clearLegacyAdminOptionsMetadata(String productId) {
        String table = sanitizeTable(props.getProductTable());
        if (!schema.hasColumn(table, "metadata")) {
            return;
        }
        try {
            String raw = jdbc.query(
                "SELECT metadata::text FROM " + table + " WHERE id = ?",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return rs.getString(1);
                },
                productId
            );
            ObjectNode meta;
            if (raw == null || raw.isBlank() || "null".equalsIgnoreCase(raw)) {
                return;
            }
            JsonNode parsed = objectMapper.readTree(raw);
            meta = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
            if (!meta.has("admin_product_options")) {
                return;
            }
            meta.remove("admin_product_options");
            PGobject pg = new PGobject();
            pg.setType("jsonb");
            pg.setValue(objectMapper.writeValueAsString(meta));
            jdbc.update("UPDATE " + table + " SET metadata = ? WHERE id = ?", pg, productId);
        } catch (Exception e) {
            log.debug("[product-options] clear legacy metadata: {}", e.getMessage());
        }
    }

    /**
     * Admin PATCH {@code variant_option_assignments}: array of
     * {@code { "variant_id", "option_id", "value" }} — sets the pivot row for that variant on that option axis.
     * Empty or null {@code value} removes existing links for that option. Values must exist (or are created) on the
     * option; {@code option_id} must belong to the product.
     */
    @Transactional
    public void syncVariantOptionAssignments(String productId, JsonNode assignmentsArray) {
        if (productId == null || productId.isBlank() || !nativeTablesPresent()) {
            return;
        }
        if (assignmentsArray == null || !assignmentsArray.isArray() || assignmentsArray.isEmpty()) {
            return;
        }
        String pid = productId.trim();
        String vtbl = sanitizeTable(props.getVariantTable());
        String optTable = sanitizeTable(props.getProductOptionTable());
        String valTable = sanitizeTable(props.getProductOptionValueTable());
        String pivotTable = sanitizeTable(props.getProductVariantOptionTable());
        Timestamp now = Timestamp.from(Instant.now());

        for (JsonNode node : assignmentsArray) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String variantId = text(node.get("variant_id"));
            String optionId = text(node.get("option_id"));
            if (variantId == null || variantId.isBlank() || optionId == null || optionId.isBlank()) {
                continue;
            }
            variantId = variantId.trim();
            optionId = optionId.trim();
            if (!variantBelongsToProduct(vtbl, variantId, pid)) {
                log.debug("[product-options] skip assignment: variant {} not in product {}", variantId, pid);
                continue;
            }
            if (!optionBelongsToProduct(optTable, optionId, pid)) {
                log.debug("[product-options] skip assignment: option {} not in product {}", optionId, pid);
                continue;
            }
            removePivotsForVariantOptionAxis(pivotTable, valTable, variantId, optionId, now);
            JsonNode valNode = node.get("value");
            String value = valNode == null || valNode.isNull() ? null : text(valNode);
            if (value == null || value.isBlank()) {
                continue;
            }
            value = value.trim();
            String valueRowId = findValueIdForOption(valTable, optionId, value);
            if (valueRowId == null) {
                resolveOrCreateValueRow(valTable, optionId, value, now);
                valueRowId = findValueIdForOption(valTable, optionId, value);
            }
            if (valueRowId != null) {
                insertPivotIfAbsent(pivotTable, variantId, valueRowId, now);
            }
        }
    }

    private boolean variantBelongsToProduct(String vTable, String variantId, String productId) {
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + vTable + " WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                Integer.class,
                variantId,
                productId
            );
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private void removePivotsForVariantOptionAxis(
        String pivotTable,
        String valTable,
        String variantId,
        String optionId,
        Timestamp now
    ) {
        List<String> valueIds;
        try {
            valueIds = jdbc.query(
                "SELECT id::text FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL",
                (rs, i) -> rs.getString(1),
                optionId
            );
        } catch (Exception e) {
            return;
        }
        for (String vid : valueIds) {
            if (vid == null) {
                continue;
            }
            try {
                if (schema.hasColumn(pivotTable, "deleted_at")) {
                    jdbc.update(
                        "UPDATE " + pivotTable + " SET deleted_at = ? WHERE variant_id = ? AND option_value_id = ? AND deleted_at IS NULL",
                        now,
                        variantId,
                        vid
                    );
                } else {
                    jdbc.update("DELETE FROM " + pivotTable + " WHERE variant_id = ? AND option_value_id = ?", variantId, vid);
                }
            } catch (Exception ex) {
                log.debug("[product-options] remove pivot variant {} value {}: {}", variantId, vid, ex.getMessage());
            }
        }
    }

    private String findValueIdForOption(String valTable, String optionId, String value) {
        try {
            List<String> ids = jdbc.query(
                "SELECT id::text FROM " + valTable + " WHERE option_id = ? AND deleted_at IS NULL AND LOWER(TRIM(value)) = LOWER(TRIM(?)) LIMIT 1",
                (rs, i) -> rs.getString(1),
                optionId,
                value
            );
            return ids.isEmpty() ? null : ids.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private static String newOptId() {
        return "opt_" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String newOptValId() {
        return "optval_" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String text(JsonNode n) {
        if (n == null || n.isNull()) {
            return null;
        }
        if (n.isTextual()) {
            String t = n.asText();
            return t.isBlank() ? null : t;
        }
        if (n.isNumber()) {
            return n.asText();
        }
        return null;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private void putIfColumn(String table, LinkedHashMap<String, Object> row, String column, Object value) {
        if (!schema.hasColumn(table, column)) {
            return;
        }
        row.put(column, value);
    }

    private void insertDynamic(String tableRaw, LinkedHashMap<String, Object> row) {
        if (row.isEmpty()) {
            return;
        }
        String table = sanitizeTable(tableRaw);
        StringBuilder sql = new StringBuilder("INSERT INTO ").append(table).append(" (");
        StringBuilder ph = new StringBuilder(" VALUES (");
        List<Object> args = new ArrayList<>();
        boolean first = true;
        for (Map.Entry<String, Object> e : row.entrySet()) {
            if (!first) {
                sql.append(", ");
                ph.append(", ");
            }
            first = false;
            sql.append(sanitizeIdent(e.getKey()));
            ph.append("?");
            args.add(e.getValue());
        }
        sql.append(")").append(ph).append(")");
        jdbc.update(sql.toString(), args.toArray());
    }

    private static String sanitizeTable(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }
        return name.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "");
    }

    private static String sanitizeIdent(String name) {
        if (name == null || name.isBlank()) {
            return "id";
        }
        return name.replaceAll("[^a-zA-Z0-9_]", "");
    }
}
