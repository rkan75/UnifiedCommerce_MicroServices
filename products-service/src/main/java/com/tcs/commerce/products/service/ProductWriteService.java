package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import com.tcs.commerce.products.web.ProductOptionDto;
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
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Persists new products aligned with a typical admin create flow (details, organize, variants):
 * product row, variants, price sets + prices, optional category / sales-channel / tag links.
 * Uses {@link CatalogSchemaCache} so inserts adapt to the catalog table shapes present in the DB.
 */
@Service
public class ProductWriteService {

    private static final Logger log = LoggerFactory.getLogger(ProductWriteService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final CatalogSchemaCache schema;
    private final ObjectMapper objectMapper;
    private final NativeProductOptionService nativeProductOptionService;

    public ProductWriteService(
        JdbcTemplate jdbc,
        ProductsProperties props,
        CatalogSchemaCache schema,
        ObjectMapper objectMapper,
        NativeProductOptionService nativeProductOptionService
    ) {
        this.jdbc = jdbc;
        this.props = props;
        this.schema = schema;
        this.objectMapper = objectMapper;
        this.nativeProductOptionService = nativeProductOptionService;
    }

    public record CreatedProduct(String id, String handle) {}

    @Transactional
    public CreatedProduct createFromAdminJson(JsonNode root) {
        if (root == null || root.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Body required");
        }
        String title = text(root.get("title"));
        if (title == null || title.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "title is required");
        }
        String handle = slugHandle(text(root.get("handle")), title);
        if (handleExists(handle)) {
            throw new ProductWriteException(HttpStatus.CONFLICT, "Handle already exists: " + handle);
        }
        String status = normalizeStatus(text(root.get("status")));
        String description = text(root.get("description"));
        String thumbnail = text(root.get("thumbnail"));
        String collectionId = text(root.get("collection_id"));
        String typeId = text(root.path("type").get("id"));
        if ((typeId == null || typeId.isBlank()) && props.getDefaultProductTypeId() != null && !props.getDefaultProductTypeId().isBlank()) {
            typeId = props.getDefaultProductTypeId().trim();
        }

        ObjectNode metadata = mergeMetadata(root.get("metadata"));
        boolean discountable = metadata.path("discountable").asBoolean(true);
        String subtitle = text(metadata.get("subtitle"));
        String shippingProfileId = text(metadata.get("shipping_profile_id"));
        metadata.remove("discountable");
        metadata.remove("subtitle");
        metadata.remove("shipping_profile_id");
        metadata.remove("category_ids");
        metadata.remove("tags");
        metadata.remove("sales_channels");

        String productId = newEntityId();
        insertProductRow(
            productId,
            title,
            subtitle,
            handle,
            description,
            thumbnail,
            status,
            toJsonb(metadata),
            collectionId,
            typeId,
            discountable,
            shippingProfileId
        );

        JsonNode variants = root.get("variants");
        if (variants == null || !variants.isArray() || variants.isEmpty()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "variants array required (at least one variant)");
        }
        int rank = 0;
        for (JsonNode v : variants) {
            createVariantWithPrices(productId, v, rank++);
        }

        linkCategories(productId, root.get("metadata"));
        linkSalesChannels(productId, root.get("metadata"));
        linkTags(productId, root.get("metadata"));

        return new CreatedProduct(productId, handle);
    }

    /**
     * Adds a variant to an existing product (admin PDP “Create variant” wizard). Persists variant row, price set + prices,
     * optional native {@code product_variant_option} assignments, and optional {@code product_variant_inventory_item} rows.
     */
    @Transactional
    public String addVariantToProduct(String productId, JsonNode body) {
        if (productId == null || productId.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "product id required");
        }
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Body required");
        }
        String pid = productId.trim();
        String pTable = sanitize(props.getProductTable());
        Integer exists;
        try {
            exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + pTable + " WHERE id = ? AND deleted_at IS NULL",
                Integer.class,
                pid
            );
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Product not found");
        }
        if (exists == null || exists == 0) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Product not found");
        }
        String title = text(body.get("title"));
        if (title == null || title.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "title is required");
        }
        int nextRank = resolveNextVariantRank(pid);
        String variantId = createVariantWithPrices(pid, body, nextRank);

        if (body.has("option_assignments") && body.get("option_assignments").isArray()) {
            ArrayNode merged = objectMapper.createArrayNode();
            for (JsonNode a : body.get("option_assignments")) {
                if (a == null || !a.isObject()) {
                    continue;
                }
                ObjectNode o = (ObjectNode) a.deepCopy();
                o.put("variant_id", variantId);
                merged.add(o);
            }
            nativeProductOptionService.syncVariantOptionAssignments(pid, merged);
        }

        if (body.path("inventory_kit").asBoolean(false)) {
            insertInventoryKitLinks(variantId, body.get("inventory_kit_items"));
        }
        return variantId;
    }

    /**
     * Lightweight list for admin inventory-kit picker (Medusa {@code inventory_item} when present).
     */
    public List<Map<String, String>> listInventoryItemsForAdmin(int limit) {
        String t = sanitize("inventory_item");
        if (!schema.hasTable(t) || !schema.hasColumn(t, "id")) {
            return List.of();
        }
        int lim = Math.min(Math.max(limit, 1), 500);
        String skuCol = schema.hasColumn(t, "sku") ? "COALESCE(sku::text, '')" : "''";
        String titleCol =
            schema.hasColumn(t, "title")
                ? "COALESCE(title::text, '')"
                : schema.hasColumn(t, "description") ? "COALESCE(description::text, '')" : "''";
        String alive = schema.hasColumn(t, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
        String orderBy = schema.hasColumn(t, "created_at") ? "created_at DESC NULLS LAST, id" : "id";
        try {
            return jdbc.query(
                "SELECT id::text, " + skuCol + ", " + titleCol + " FROM "
                    + t
                    + " WHERE " + alive + " ORDER BY " + orderBy + " LIMIT ?",
                (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("id", rs.getString(1));
                    m.put("sku", rs.getString(2) != null ? rs.getString(2) : "");
                    m.put("title", rs.getString(3) != null ? rs.getString(3) : "");
                    return m;
                },
                lim
            );
        } catch (Exception e) {
            log.debug("[product-write] list inventory_item: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * For inventory-kit UI: each row is an {@code inventory_item_id} already linked to a <strong>sibling</strong> variant of
     * this product, with human-readable option axes (Color, Size, …) from native {@code product_variant_option} when present.
     */
    public List<Map<String, Object>> listInventoryKitCandidates(String productId) {
        if (productId == null || productId.isBlank()) {
            return List.of();
        }
        String pid = productId.trim();
        String vTable = sanitize(props.getVariantTable());
        String pvi = sanitize("product_variant_inventory_item");
        if (!schema.hasTable(pvi)
            || !schema.hasColumn(pvi, "variant_id")
            || !schema.hasColumn(pvi, "inventory_item_id")
            || !schema.hasTable(vTable)
            || !schema.hasColumn(vTable, "product_id")) {
            return List.of();
        }
        String delPvi = schema.hasColumn(pvi, "deleted_at") ? " AND pvi.deleted_at IS NULL" : "";
        String delV = schema.hasColumn(vTable, "deleted_at") ? " AND v.deleted_at IS NULL" : "";
        String sql =
            "SELECT pvi.variant_id::text AS variant_id, pvi.inventory_item_id::text AS inventory_item_id, "
                + "COALESCE(v.title::text, '') AS variant_title, COALESCE(v.sku::text, '') AS variant_sku "
                + "FROM "
                + pvi
                + " pvi INNER JOIN "
                + vTable
                + " v ON v.id = pvi.variant_id "
                + "WHERE v.product_id = ?"
                + delPvi
                + delV;
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList(sql, pid);
        } catch (Exception e) {
            log.debug("[product-write] inventory kit candidates: {}", e.getMessage());
            return List.of();
        }
        if (rows.isEmpty()) {
            return List.of();
        }
        Set<String> variantIds = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            String vid = plainStr(r.get("variant_id"));
            if (vid != null) {
                variantIds.add(vid);
            }
        }
        Map<String, Map<String, String>> matrix = nativeProductOptionService.loadVariantOptionMatrix(new ArrayList<>(variantIds));
        List<ProductOptionDto> productOpts = nativeProductOptionService.loadProductOptions(pid);

        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seenItemIds = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            String iid = plainStr(r.get("inventory_item_id"));
            String vid = plainStr(r.get("variant_id"));
            if (iid == null) {
                continue;
            }
            if (seenItemIds.contains(iid)) {
                continue;
            }
            seenItemIds.add(iid);
            String vtitle = plainStr(r.get("variant_title"));
            String vsku = plainStr(r.get("variant_sku"));

            List<Map<String, String>> options = new ArrayList<>();
            StringBuilder label = new StringBuilder();
            Map<String, String> vm = vid != null && matrix != null ? matrix.getOrDefault(vid, Map.of()) : Map.of();
            if (productOpts != null) {
                for (ProductOptionDto po : productOpts) {
                    if (po == null || po.id() == null || po.id().isBlank()) {
                        continue;
                    }
                    String val = vm.get(po.id());
                    if (val == null || val.isBlank()) {
                        continue;
                    }
                    Map<String, String> pair = new LinkedHashMap<>();
                    String ot = po.title() != null && !po.title().isBlank() ? po.title() : po.id();
                    pair.put("option_title", ot);
                    pair.put("value", val);
                    options.add(pair);
                    if (label.length() > 0) {
                        label.append(" · ");
                    }
                    label.append(ot).append(": ").append(val);
                }
            }
            if (label.length() == 0) {
                if (vtitle != null && !vtitle.isBlank()) {
                    label.append(vtitle);
                }
                if (vsku != null && !vsku.isBlank()) {
                    if (label.length() > 0) {
                        label.append(" · ");
                    }
                    label.append("SKU ").append(vsku);
                }
            }
            if (label.length() == 0) {
                label.append("Item ").append(iid.length() > 12 ? iid.substring(0, 12) + "…" : iid);
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("inventory_item_id", iid);
            row.put("source_variant_id", vid);
            row.put("variant_title", vtitle != null ? vtitle : "");
            row.put("variant_sku", vsku != null ? vsku : "");
            row.put("options", options);
            row.put("label", label.toString());
            out.add(row);
        }
        return out;
    }

    private static String plainStr(Object o) {
        if (o == null) {
            return null;
        }
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private int resolveNextVariantRank(String productId) {
        String vTable = sanitize(props.getVariantTable());
        if (schema.hasColumn(vTable, "variant_rank")) {
            try {
                Integer max = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(variant_rank), -1) FROM " + vTable + " WHERE product_id = ? AND deleted_at IS NULL",
                    Integer.class,
                    productId
                );
                return (max == null ? -1 : max) + 1;
            } catch (Exception e) {
                log.debug("[product-write] next variant_rank: {}", e.getMessage());
                return 0;
            }
        }
        try {
            Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + vTable + " WHERE product_id = ? AND deleted_at IS NULL",
                Integer.class,
                productId
            );
            return c == null ? 0 : c;
        } catch (Exception e) {
            return 0;
        }
    }

    private void insertInventoryKitLinks(String variantId, JsonNode items) {
        String kitTable = sanitize("product_variant_inventory_item");
        if (!schema.hasTable(kitTable) || items == null || !items.isArray()) {
            return;
        }
        Timestamp now = Timestamp.from(Instant.now());
        for (JsonNode it : items) {
            if (it == null || !it.isObject()) {
                continue;
            }
            String iid = text(it.get("inventory_item_id"));
            int qty = it.path("quantity").asInt(0);
            if (iid == null || iid.isBlank() || qty <= 0) {
                continue;
            }
            LinkedHashMap<String, Object> row = new LinkedHashMap<>();
            putIfColumn(kitTable, row, "id", newEntityId());
            putIfColumn(kitTable, row, "variant_id", variantId);
            putIfColumn(kitTable, row, "inventory_item_id", iid.trim());
            putIfColumn(kitTable, row, "required_quantity", qty);
            putIfColumn(kitTable, row, "quantity", qty);
            putIfColumn(kitTable, row, "created_at", now);
            putIfColumn(kitTable, row, "updated_at", now);
            putIfColumn(kitTable, row, "deleted_at", null);
            if (row.size() <= 1) {
                continue;
            }
            try {
                insertDynamic(kitTable, row);
            } catch (Exception e) {
                log.warn("[product-write] inventory kit insert skipped: {}", e.getMessage());
            }
        }
    }

    /**
     * Updates core product fields from the admin “Edit product” drawer (status, title, subtitle, handle, material, description, discountable).
     */
    @Transactional
    public void updateProductDetails(String productId, JsonNode body) {
        if (productId == null || productId.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "product id required");
        }
        if (body == null || body.isNull()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "Body required");
        }
        String table = sanitize(props.getProductTable());
        Integer exists;
        try {
            exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE id = ? AND deleted_at IS NULL",
                Integer.class,
                productId.trim()
            );
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Product not found");
        }
        if (exists == null || exists == 0) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Product not found");
        }

        String title = text(body.get("title"));
        if (title == null || title.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "title is required");
        }
        String handle;
        if (!body.has("handle") || body.get("handle").isNull()) {
            String existing;
            try {
                existing = jdbc.queryForObject(
                    "SELECT handle FROM " + table + " WHERE id = ? AND deleted_at IS NULL",
                    String.class,
                    productId.trim()
                );
            } catch (Exception e) {
                existing = null;
            }
            handle =
                existing != null && !existing.isBlank()
                    ? existing.trim()
                    : slugHandle(null, title);
        } else {
            String handleInput = normalizeHandleInput(text(body.get("handle")));
            handle = slugHandle(handleInput, title);
        }
        if (handleExistsForOtherProduct(handle, productId.trim())) {
            throw new ProductWriteException(HttpStatus.CONFLICT, "Handle already exists: " + handle);
        }

        String status = normalizeStatus(text(body.get("status")));
        String description = text(body.get("description"));
        boolean hasSubtitle = body.has("subtitle");
        boolean hasMaterial = body.has("material");
        boolean hasDiscountable = body.has("discountable") && !body.get("discountable").isNull();
        String subtitle = text(body.get("subtitle"));
        String material = text(body.get("material"));
        boolean discountable = hasDiscountable
            ? body.get("discountable").asBoolean(true)
            : true;

        boolean hasThumbnail = body.has("thumbnail");
        boolean hasGallery = body.has("gallery") && body.get("gallery") != null && body.get("gallery").isArray();
        boolean hasAdminOptions = body.has("admin_options") && body.get("admin_options") != null && body.get("admin_options").isArray();
        boolean hasVariantOptionAssignments =
            body.has("variant_option_assignments")
                && body.get("variant_option_assignments") != null
                && body.get("variant_option_assignments").isArray();

        List<String> setClauses = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        addUpdateIfColumn(table, setClauses, args, "title", title);
        addUpdateIfColumn(table, setClauses, args, "handle", handle);
        addUpdateIfColumn(table, setClauses, args, "description", blankToNull(description));
        addUpdateIfColumn(table, setClauses, args, "status", status);
        if (hasThumbnail) {
            JsonNode tn = body.get("thumbnail");
            String th = tn != null && tn.isNull() ? null : text(tn);
            addUpdateIfColumn(table, setClauses, args, "thumbnail", blankToNull(th));
        }
        addUpdateIfColumn(table, setClauses, args, "subtitle", blankToNull(subtitle));
        if (schema.hasColumn(table, "discountable")) {
            addUpdateIfColumn(table, setClauses, args, "discountable", discountable);
        }
        if (schema.hasColumn(table, "material")) {
            addUpdateIfColumn(table, setClauses, args, "material", blankToNull(material));
        }
        if (schema.hasColumn(table, "updated_at")) {
            setClauses.add(sanitize("updated_at") + " = ?");
            args.add(Timestamp.from(Instant.now()));
        }

        if (!setClauses.isEmpty()) {
            String sql = "UPDATE " + table + " SET " + String.join(", ", setClauses) + " WHERE id = ? AND deleted_at IS NULL";
            args.add(productId.trim());
            jdbc.update(sql, args.toArray());
        }

        if (schema.hasColumn(table, "metadata")) {
            // Keep metadata.general fields in sync because admin UI currently reads subtitle/material/discountable from metadata.
            mergeGeneralFieldsMetadata(
                productId.trim(),
                hasSubtitle,
                subtitle,
                hasMaterial,
                material,
                hasDiscountable,
                discountable
            );
        }
        if (hasGallery && schema.hasColumn(table, "metadata")) {
            mergeGalleryMetadata(productId.trim(), body.get("gallery"));
        }
        if (hasAdminOptions) {
            if (nativeProductOptionService.nativeTablesPresent()) {
                nativeProductOptionService.syncAdminOptionsToNativeTables(productId.trim(), body.get("admin_options"));
            } else if (schema.hasColumn(table, "metadata")) {
                mergeAdminProductOptionsMetadata(productId.trim(), body.get("admin_options"));
            }
        }
        if (hasVariantOptionAssignments) {
            if (nativeProductOptionService.nativeTablesPresent()) {
                nativeProductOptionService.syncVariantOptionAssignments(productId.trim(), body.get("variant_option_assignments"));
            } else {
                String vTable = sanitize(props.getVariantTable());
                if (schema.hasColumn(vTable, "metadata")) {
                    mergeVariantOptionAssignmentsMetadata(productId.trim(), body.get("variant_option_assignments"));
                }
            }
        }
        boolean hasMetadataPatch = body.has("metadata") && body.get("metadata").isObject();
        if (hasMetadataPatch && schema.hasColumn(table, "metadata")) {
            mergeProductMetadataPatch(productId.trim(), (ObjectNode) body.get("metadata"));
        }
    }

    /**
     * Shallow-merges top-level keys into {@code product.metadata}. JSON {@code null} removes a key.
     * Keys omitted from the patch are unchanged (e.g. {@code admin_gallery}).
     */
    private void mergeProductMetadataPatch(String productId, ObjectNode patch) {
        if (patch == null || patch.isEmpty()) {
            return;
        }
        String table = sanitize(props.getProductTable());
        if (!schema.hasColumn(table, "metadata")) {
            return;
        }
        String pid = productId.trim();
        try {
            String raw = jdbc.query(
                "SELECT metadata::text FROM " + table + " WHERE id = ?",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return rs.getString(1);
                },
                pid
            );
            ObjectNode meta;
            if (raw == null || raw.isBlank() || "null".equalsIgnoreCase(raw)) {
                meta = objectMapper.createObjectNode();
            } else {
                JsonNode parsed = objectMapper.readTree(raw);
                meta = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
            }
            Iterator<Map.Entry<String, JsonNode>> it = patch.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                String k = e.getKey();
                if (k == null || k.isBlank()) {
                    continue;
                }
                JsonNode v = e.getValue();
                if (v == null || v.isNull()) {
                    meta.remove(k);
                } else {
                    meta.set(k, v);
                }
            }
            PGobject pg = toJsonb(meta);
            jdbc.update("UPDATE " + table + " SET metadata = ? WHERE id = ?", pg, pid);
        } catch (ProductWriteException e) {
            throw e;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "metadata patch: " + e.getMessage());
        }
    }

    /** Persists per-variant option picks in {@code metadata.admin_option_values} when native pivot tables are absent. */
    private void mergeVariantOptionAssignmentsMetadata(String productId, JsonNode assignmentsArray) {
        if (assignmentsArray == null || !assignmentsArray.isArray() || assignmentsArray.isEmpty()) {
            return;
        }
        String vTable = sanitize(props.getVariantTable());
        if (!schema.hasColumn(vTable, "metadata")) {
            return;
        }
        String pid = productId.trim();
        for (JsonNode node : assignmentsArray) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String variantId = text(node.get("variant_id"));
            String optionId = text(node.get("option_id"));
            if (variantId == null || optionId == null) {
                continue;
            }
            variantId = variantId.trim();
            optionId = optionId.trim();
            String value = null;
            if (node.has("value") && !node.get("value").isNull()) {
                JsonNode vn = node.get("value");
                if (vn.isTextual()) {
                    String t = vn.asText().trim();
                    value = t.isEmpty() ? null : t;
                }
            }
            try {
                Integer ok = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + vTable + " WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                    Integer.class,
                    variantId,
                    pid
                );
                if (ok == null || ok == 0) {
                    continue;
                }
            } catch (Exception e) {
                continue;
            }
            String raw;
            try {
                raw = jdbc.query(
                    "SELECT metadata::text FROM " + vTable + " WHERE id = ?",
                    rs -> {
                        if (!rs.next()) {
                            return null;
                        }
                        return rs.getString(1);
                    },
                    variantId
                );
            } catch (Exception e) {
                continue;
            }
            ObjectNode meta;
            try {
                if (raw == null || raw.isBlank() || "null".equalsIgnoreCase(raw)) {
                    meta = objectMapper.createObjectNode();
                } else {
                    JsonNode parsed = objectMapper.readTree(raw);
                    meta = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
                }
            } catch (Exception e) {
                meta = objectMapper.createObjectNode();
            }
            ObjectNode aov;
            if (meta.has("admin_option_values") && meta.get("admin_option_values").isObject()) {
                aov = (ObjectNode) meta.get("admin_option_values");
            } else {
                aov = objectMapper.createObjectNode();
                meta.set("admin_option_values", aov);
            }
            String key = optionId.toLowerCase(Locale.ROOT);
            if (value == null || value.isBlank()) {
                aov.remove(key);
            } else {
                aov.put(key, value);
            }
            try {
                PGobject pg = toJsonb(meta);
                if (schema.hasColumn(vTable, "updated_at")) {
                    jdbc.update(
                        "UPDATE " + vTable + " SET metadata = ?, updated_at = ? WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                        pg,
                        Timestamp.from(Instant.now()),
                        variantId,
                        pid
                    );
                } else {
                    jdbc.update(
                        "UPDATE " + vTable + " SET metadata = ? WHERE id = ? AND product_id = ? AND deleted_at IS NULL",
                        pg,
                        variantId,
                        pid
                    );
                }
            } catch (Exception e) {
                log.warn("[product-write] variant option assignments metadata: {}", e.getMessage());
            }
        }
    }

    private void mergeGeneralFieldsMetadata(
        String productId,
        boolean hasSubtitle,
        String subtitleOrNull,
        boolean hasMaterial,
        String materialOrNull,
        boolean hasDiscountable,
        boolean discountable
    ) {
        String table = sanitize(props.getProductTable());
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
                meta = objectMapper.createObjectNode();
            } else {
                JsonNode parsed = objectMapper.readTree(raw);
                meta = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
            }
            if (hasSubtitle) {
                if (subtitleOrNull == null || subtitleOrNull.isBlank()) {
                    meta.remove("subtitle");
                } else {
                    meta.put("subtitle", subtitleOrNull);
                }
            }
            if (hasMaterial) {
                if (materialOrNull == null || materialOrNull.isBlank()) {
                    meta.remove("material");
                } else {
                    meta.put("material", materialOrNull);
                }
            }
            if (hasDiscountable) {
                meta.put("discountable", discountable);
            }
            PGobject pg = toJsonb(meta);
            jdbc.update("UPDATE " + table + " SET metadata = ? WHERE id = ?", pg, productId);
        } catch (ProductWriteException e) {
            throw e;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "metadata merge: " + e.getMessage());
        }
    }

    /** Persists gallery image URLs for admin PDP (metadata.admin_gallery); thumbnail column is updated separately when sent. */
    private void mergeGalleryMetadata(String productId, JsonNode galleryNode) {
        String table = sanitize(props.getProductTable());
        if (!schema.hasColumn(table, "metadata")) {
            return;
        }
        if (galleryNode == null || !galleryNode.isArray()) {
            return;
        }
        List<String> urls = new ArrayList<>();
        for (JsonNode n : galleryNode) {
            if (n != null && n.isTextual()) {
                String s = n.asText();
                if (s != null && !s.isBlank()) {
                    urls.add(s);
                }
            }
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
                meta = objectMapper.createObjectNode();
            } else {
                JsonNode parsed = objectMapper.readTree(raw);
                meta = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
            }
            ArrayNode arr = objectMapper.createArrayNode();
            for (String u : urls) {
                arr.add(u);
            }
            meta.set("admin_gallery", arr);
            PGobject pg = toJsonb(meta);
            jdbc.update("UPDATE " + table + " SET metadata = ? WHERE id = ?", pg, productId);
        } catch (ProductWriteException e) {
            throw e;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "metadata gallery: " + e.getMessage());
        }
    }

    /** Persists admin-managed product options for PDP (metadata.admin_product_options). */
    private void mergeAdminProductOptionsMetadata(String productId, JsonNode optionsNode) {
        String table = sanitize(props.getProductTable());
        if (!schema.hasColumn(table, "metadata")) {
            return;
        }
        ArrayNode normalized = objectMapper.createArrayNode();
        if (optionsNode != null && optionsNode.isArray()) {
            for (JsonNode n : optionsNode) {
                if (n == null || !n.isObject()) {
                    continue;
                }
                String title = text(n.get("title"));
                if (title == null || title.isBlank()) {
                    continue;
                }
                String id = text(n.get("id"));
                if (id == null || id.isBlank()) {
                    id = slugHandle(null, title).replace('-', '_');
                }
                ArrayNode vals = objectMapper.createArrayNode();
                JsonNode va = n.get("values");
                if (va != null && va.isArray()) {
                    for (JsonNode v : va) {
                        if (v != null && v.isTextual()) {
                            String s = v.asText().trim();
                            if (!s.isEmpty()) {
                                vals.add(s);
                            }
                        }
                    }
                }
                ObjectNode o = objectMapper.createObjectNode();
                o.put("id", id.trim());
                o.put("title", title.trim());
                o.set("values", vals);
                normalized.add(o);
            }
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
                meta = objectMapper.createObjectNode();
            } else {
                JsonNode parsed = objectMapper.readTree(raw);
                meta = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
            }
            meta.set("admin_product_options", normalized);
            PGobject pg = toJsonb(meta);
            jdbc.update("UPDATE " + table + " SET metadata = ? WHERE id = ?", pg, productId);
        } catch (ProductWriteException e) {
            throw e;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "metadata admin_product_options: " + e.getMessage());
        }
    }

    private void addUpdateIfColumn(String table, List<String> setClauses, List<Object> args, String column, Object value) {
        if (!schema.hasColumn(table, column)) {
            return;
        }
        setClauses.add(sanitize(column) + " = ?");
        args.add(value);
    }

    private static String normalizeHandleInput(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim();
        while (t.startsWith("/")) {
            t = t.substring(1).trim();
        }
        return t.isBlank() ? null : t;
    }

    private boolean handleExistsForOtherProduct(String handle, String excludeProductId) {
        String table = sanitize(props.getProductTable());
        if (handle == null || handle.isBlank()) {
            return false;
        }
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE deleted_at IS NULL AND LOWER(TRIM(handle)) = LOWER(?) AND id <> ?",
                Integer.class,
                handle.trim(),
                excludeProductId.trim()
            );
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private void insertProductRow(
        String productId,
        String title,
        String subtitle,
        String handle,
        String description,
        String thumbnail,
        String status,
        PGobject metadataJson,
        String collectionId,
        String typeId,
        boolean discountable,
        String shippingProfileId
    ) {
        String table = sanitize(props.getProductTable());
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        putIfColumn(table, row, "id", productId);
        putIfColumn(table, row, "title", title);
        putIfColumn(table, row, "subtitle", blankToNull(subtitle));
        putIfColumn(table, row, "handle", handle);
        putIfColumn(table, row, "description", blankToNull(description));
        putIfColumn(table, row, "thumbnail", blankToNull(thumbnail));
        putIfColumn(table, row, "status", status);
        putIfColumn(table, row, "metadata", metadataJson);
        putIfColumn(table, row, "collection_id", blankToNull(collectionId));
        putIfColumn(table, row, "type_id", blankToNull(typeId));
        putIfColumn(table, row, "discountable", discountable);
        putIfColumn(table, row, "shipping_profile_id", blankToNull(shippingProfileId));
        putIfColumn(table, row, "is_giftcard", false);
        Timestamp now = Timestamp.from(Instant.now());
        putIfColumn(table, row, "created_at", now);
        putIfColumn(table, row, "updated_at", now);
        putIfColumn(table, row, "deleted_at", null);
        if (row.isEmpty()) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "No writable columns found on table " + table);
        }
        insertDynamic(table, row);
    }

    private String createVariantWithPrices(String productId, JsonNode v, int variantRank) {
        String variantId = newEntityId();
        String title = text(v.get("title"));
        if (title == null || title.isBlank()) {
            title = "Default";
        }
        String sku = text(v.get("sku"));
        boolean manageInv = v.path("manage_inventory").asBoolean(false);
        boolean allowBo = v.path("allow_backorder").asBoolean(false);

        String priceSetId = newEntityId();
        if (schema.hasTable("price_set")) {
            insertPriceSet(priceSetId);
        }

        List<Money> prices = extractPrices(v);
        if (prices.isEmpty()) {
            log.debug("[product-write] variant {} has no prices (allowed — prices may be added later)", variantId);
        } else {
            insertMoneyForPriceSet(priceSetId, prices);
        }

        String vTable = sanitize(props.getVariantTable());
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        putIfColumn(vTable, row, "id", variantId);
        putIfColumn(vTable, row, "product_id", productId);
        putIfColumn(vTable, row, "title", title);
        putIfColumn(vTable, row, "sku", blankToNull(sku));
        putIfColumn(vTable, row, "variant_rank", variantRank);
        putIfColumn(vTable, row, "manage_inventory", manageInv);
        putIfColumn(vTable, row, "allow_backorder", allowBo);
        putIfColumn(vTable, row, "inventory_quantity", manageInv ? 0 : null);
        putIfColumn(vTable, row, "price_set_id", schema.hasColumn(vTable, "price_set_id") ? priceSetId : null);
        Timestamp now = Timestamp.from(Instant.now());
        putIfColumn(vTable, row, "created_at", now);
        putIfColumn(vTable, row, "updated_at", now);
        putIfColumn(vTable, row, "deleted_at", null);
        insertDynamic(vTable, row);

        if (!schema.hasColumn(vTable, "price_set_id") && schema.hasTable("product_variant_price_set") && schema.hasColumn("product_variant_price_set", "variant_id")) {
            insertProductVariantPriceSetLink(variantId, priceSetId);
        }
        return variantId;
    }

    /**
     * Link row between variant and price_set. PK {@code id} is NOT NULL — use explicit SQL so the insert
     * always includes {@code id} (dynamic column maps were still producing two-column inserts in some environments).
     */
    private void insertProductVariantPriceSetLink(String variantId, String priceSetId) {
        String table = sanitize("product_variant_price_set");
        String linkId = newEntityId();
        Timestamp ts = Timestamp.from(Instant.now());
        try {
            jdbc.update(
                "INSERT INTO " + table + " (id, variant_id, price_set_id, created_at, updated_at, deleted_at) VALUES (?,?,?,?,?,?)",
                linkId,
                variantId,
                priceSetId,
                ts,
                ts,
                null
            );
        } catch (Exception e) {
            log.debug("[product-write] variant_price_set link insert (6 col) failed: {}", e.getMessage());
            try {
                jdbc.update(
                    "INSERT INTO " + table + " (id, variant_id, price_set_id, created_at, updated_at) VALUES (?,?,?,?,?)",
                    linkId,
                    variantId,
                    priceSetId,
                    ts,
                    ts
                );
            } catch (Exception e2) {
                log.debug("[product-write] variant_price_set link insert (5 col) failed: {}", e2.getMessage());
                jdbc.update(
                    "INSERT INTO " + table + " (id, variant_id, price_set_id) VALUES (?,?,?)",
                    linkId,
                    variantId,
                    priceSetId
                );
            }
        }
    }

    private record Money(String currency, long amountMinor) {}

    private List<Money> extractPrices(JsonNode v) {
        List<Money> out = new ArrayList<>();
        if (v != null && v.has("prices") && v.get("prices").isArray()) {
            for (JsonNode p : v.get("prices")) {
                addMoney(out, p);
            }
        }
        JsonNode cp = v.get("calculated_price");
        if (cp != null && cp.isObject()) {
            addMoney(out, cp);
        }
        JsonNode meta = v.get("metadata");
        if (meta != null && meta.has("extra_prices") && meta.get("extra_prices").isArray()) {
            for (JsonNode p : meta.get("extra_prices")) {
                addMoney(out, p);
            }
        }
        return out;
    }

    private void addMoney(List<Money> out, JsonNode p) {
        if (p == null || !p.isObject()) {
            return;
        }
        String cc = text(p.get("currency_code"));
        if (cc == null || cc.isBlank()) {
            return;
        }
        long amt = p.path("calculated_amount").asLong(Long.MIN_VALUE);
        if (amt == Long.MIN_VALUE) {
            amt = p.path("amount").asLong(0);
        }
        out.add(new Money(cc.trim().toLowerCase(Locale.ROOT), amt));
    }

    private void insertPriceSet(String priceSetId) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        putIfColumn("price_set", row, "id", priceSetId);
        Timestamp now = Timestamp.from(Instant.now());
        putIfColumn("price_set", row, "created_at", now);
        putIfColumn("price_set", row, "updated_at", now);
        putIfColumn("price_set", row, "deleted_at", null);
        if (row.size() > 1) {
            insertDynamic("price_set", row);
        }
    }

    /**
     * Some catalog schemas store {@code amount} / {@code raw_amount} on {@code price} as {@code jsonb} with {@code value} (minor units as string) and {@code precision} (e.g. 20).
     */
    private PGobject priceAmountMinorUnitsJsonb(long minor) {
        try {
            ObjectNode n = objectMapper.createObjectNode();
            n.put("value", String.valueOf(minor));
            n.put("precision", 20);
            PGobject pg = new PGobject();
            pg.setType("jsonb");
            pg.setValue(objectMapper.writeValueAsString(n));
            return pg;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "price money jsonb: " + e.getMessage());
        }
    }

    private void putPriceMoneyColumn(String table, LinkedHashMap<String, Object> row, String column, long minor) {
        if (!schema.hasColumn(table, column)) {
            return;
        }
        if (schema.columnIsJsonb(table, column)) {
            putIfColumn(table, row, column, priceAmountMinorUnitsJsonb(minor));
        } else {
            putIfColumn(table, row, column, minor);
        }
    }

    private void insertMoneyForPriceSet(String priceSetId, List<Money> prices) {
        for (Money m : prices) {
            if (m.amountMinor() < 0) {
                continue;
            }
            String priceId = newEntityId();
            if (schema.hasTable("price") && schema.hasColumn("price", "price_set_id")) {
                LinkedHashMap<String, Object> row = new LinkedHashMap<>();
                putIfColumn("price", row, "id", priceId);
                putIfColumn("price", row, "price_set_id", priceSetId);
                putIfColumn("price", row, "currency_code", m.currency());
                putPriceMoneyColumn("price", row, "amount", m.amountMinor());
                putPriceMoneyColumn("price", row, "raw_amount", m.amountMinor());
                Timestamp now = Timestamp.from(Instant.now());
                putIfColumn("price", row, "created_at", now);
                putIfColumn("price", row, "updated_at", now);
                putIfColumn("price", row, "deleted_at", null);
                putIfColumn("price", row, "min_quantity", null);
                putIfColumn("price", row, "max_quantity", null);
                putIfColumn("price", row, "rules_count", 0);
                if (row.size() > 1) {
                    insertDynamic("price", row);
                    continue;
                }
            }
            if (schema.hasTable("price_set_money_amount")) {
                if (schema.hasColumn("price_set_money_amount", "amount")) {
                    LinkedHashMap<String, Object> row = new LinkedHashMap<>();
                    putIfColumn("price_set_money_amount", row, "id", priceId);
                    putIfColumn("price_set_money_amount", row, "price_set_id", priceSetId);
                    putIfColumn("price_set_money_amount", row, "currency_code", m.currency());
                    putPriceMoneyColumn("price_set_money_amount", row, "amount", m.amountMinor());
                    Timestamp now = Timestamp.from(Instant.now());
                    putIfColumn("price_set_money_amount", row, "created_at", now);
                    putIfColumn("price_set_money_amount", row, "updated_at", now);
                    putIfColumn("price_set_money_amount", row, "deleted_at", null);
                    if (row.size() > 1) {
                        insertDynamic("price_set_money_amount", row);
                    }
                }
            }
        }
    }

    private void linkCategories(String productId, JsonNode metadataRoot) {
        if (metadataRoot == null || !metadataRoot.isObject()) {
            return;
        }
        JsonNode arr = metadataRoot.get("category_ids");
        if (arr == null || !arr.isArray()) {
            return;
        }
        String linkTable = sanitizeLower(props.getProductCategoryLinkTable());
        String catCol = sanitizeLower(props.getProductCategoryLinkTableCategoryColumn());
        if (!schema.hasTable(linkTable) || !schema.hasColumn(linkTable, "product_id") || !schema.hasColumn(linkTable, catCol)) {
            return;
        }
        for (JsonNode idNode : arr) {
            String cid = text(idNode);
            if (cid == null || cid.isBlank()) {
                continue;
            }
            LinkedHashMap<String, Object> row = new LinkedHashMap<>();
            putIfColumn(linkTable, row, "product_id", productId);
            putIfColumn(linkTable, row, catCol, cid.trim());
            putIfColumn(linkTable, row, "id", newEntityId());
            Timestamp now = Timestamp.from(Instant.now());
            putIfColumn(linkTable, row, "created_at", now);
            putIfColumn(linkTable, row, "updated_at", now);
            if (row.size() >= 2) {
                try {
                    insertDynamic(linkTable, row);
                } catch (Exception e) {
                    log.warn("[product-write] category link skipped: {}", e.getMessage());
                }
            }
        }
    }

    private void linkSalesChannels(String productId, JsonNode metadataRoot) {
        if (metadataRoot == null || !metadataRoot.isObject()) {
            return;
        }
        JsonNode arr = metadataRoot.get("sales_channels");
        if (arr == null || !arr.isArray()) {
            return;
        }
        String linkTable = sanitizeLower(props.getProductSalesChannelLinkTable());
        if (linkTable.isBlank() || !schema.hasTable(linkTable) || !schema.hasColumn(linkTable, "product_id")) {
            return;
        }
        String scCol = schema.hasColumn(linkTable, "sales_channel_id") ? "sales_channel_id" : null;
        if (scCol == null) {
            return;
        }
        for (JsonNode ch : arr) {
            String sid = text(ch.get("id"));
            if (sid == null || sid.isBlank()) {
                continue;
            }
            LinkedHashMap<String, Object> row = new LinkedHashMap<>();
            putIfColumn(linkTable, row, "product_id", productId);
            putIfColumn(linkTable, row, scCol, sid.trim());
            putIfColumn(linkTable, row, "id", newEntityId());
            Timestamp now = Timestamp.from(Instant.now());
            putIfColumn(linkTable, row, "created_at", now);
            putIfColumn(linkTable, row, "updated_at", now);
            putIfColumn(linkTable, row, "deleted_at", null);
            if (row.size() >= 2) {
                try {
                    insertDynamic(linkTable, row);
                } catch (Exception e) {
                    log.warn("[product-write] sales channel link skipped: {}", e.getMessage());
                }
            }
        }
    }

    private void linkTags(String productId, JsonNode metadataRoot) {
        String linkTable = sanitizeLower(props.getProductTagLinkTable());
        String tagTable = sanitizeLower(props.getProductTagTable());
        if (linkTable.isBlank() || tagTable.isBlank() || !schema.hasTable(linkTable) || !schema.hasTable(tagTable)) {
            mergeTagsIntoMetadata(productId, metadataRoot);
            return;
        }
        if (metadataRoot == null || !metadataRoot.isObject()) {
            return;
        }
        JsonNode arr = metadataRoot.get("tags");
        if (arr == null || !arr.isArray()) {
            return;
        }
        String tagIdCol = sanitizeLower(props.getProductTagIdColumn());
        String tagValCol = sanitizeLower(props.getProductTagValueColumn());
        String lp = sanitizeLower(props.getProductTagLinkProductColumn());
        String lt = sanitizeLower(props.getProductTagLinkTagColumn());
        for (JsonNode t : arr) {
            String tagVal = text(t);
            if (tagVal == null || tagVal.isBlank()) {
                continue;
            }
            String tagId = resolveOrCreateTagId(tagTable, tagIdCol, tagValCol, tagVal.trim());
            if (tagId == null) {
                continue;
            }
            LinkedHashMap<String, Object> row = new LinkedHashMap<>();
            putIfColumn(linkTable, row, lp, productId);
            putIfColumn(linkTable, row, lt, tagId);
            putIfColumn(linkTable, row, "id", newEntityId());
            Timestamp now = Timestamp.from(Instant.now());
            putIfColumn(linkTable, row, "created_at", now);
            putIfColumn(linkTable, row, "updated_at", now);
            if (row.size() >= 2) {
                try {
                    insertDynamic(linkTable, row);
                } catch (Exception e) {
                    log.warn("[product-write] tag link skipped: {}", e.getMessage());
                }
            }
        }
    }

    private void mergeTagsIntoMetadata(String productId, JsonNode metadataRoot) {
        // If no relational tag pivot, tags still land in product.metadata via separate UPDATE
        if (metadataRoot == null || !metadataRoot.isObject() || !metadataRoot.has("tags")) {
            return;
        }
        try {
            ObjectNode meta = objectMapper.createObjectNode();
            meta.set("tags", metadataRoot.get("tags"));
            PGobject pg = toJsonb(meta);
            String table = sanitize(props.getProductTable());
            if (schema.hasColumn(table, "metadata")) {
                jdbc.update("UPDATE " + table + " SET metadata = COALESCE(metadata, '{}'::jsonb) || ?::jsonb WHERE id = ?", pg, productId);
            }
        } catch (Exception e) {
            log.debug("[product-write] metadata tag merge skipped: {}", e.getMessage());
        }
    }

    private String resolveOrCreateTagId(String tagTable, String idCol, String valCol, String value) {
        try {
            List<String> ids = jdbc.query(
                "SELECT " + idCol + "::text FROM " + tagTable + " WHERE deleted_at IS NULL AND LOWER(TRIM(" + valCol + "::text)) = LOWER(?) LIMIT 1",
                (rs, i) -> rs.getString(1),
                value
            );
            if (!ids.isEmpty()) {
                return ids.get(0);
            }
            String newId = newEntityId();
            LinkedHashMap<String, Object> row = new LinkedHashMap<>();
            putIfColumn(tagTable, row, idCol, newId);
            putIfColumn(tagTable, row, valCol, value);
            Timestamp now = Timestamp.from(Instant.now());
            putIfColumn(tagTable, row, "created_at", now);
            putIfColumn(tagTable, row, "updated_at", now);
            putIfColumn(tagTable, row, "deleted_at", null);
            insertDynamic(tagTable, row);
            return newId;
        } catch (Exception e) {
            log.warn("[product-write] tag resolve/create failed: {}", e.getMessage());
            return null;
        }
    }

    private ObjectNode mergeMetadata(JsonNode meta) {
        ObjectNode out = objectMapper.createObjectNode();
        if (meta != null && meta.isObject()) {
            out.setAll((ObjectNode) meta);
        }
        return out;
    }

    private PGobject toJsonb(ObjectNode node) {
        try {
            PGobject pg = new PGobject();
            pg.setType("jsonb");
            pg.setValue(objectMapper.writeValueAsString(node));
            return pg;
        } catch (Exception e) {
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "metadata json: " + e.getMessage());
        }
    }

    private boolean handleExists(String handle) {
        String table = sanitize(props.getProductTable());
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE deleted_at IS NULL AND LOWER(TRIM(handle)) = LOWER(?)",
                Integer.class,
                handle
            );
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
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
        String table = sanitize(tableRaw);
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
            sql.append(sanitize(e.getKey()));
            ph.append("?");
            args.add(e.getValue());
        }
        sql.append(")").append(ph).append(")");
        jdbc.update(sql.toString(), args.toArray());
    }

    private static String text(JsonNode n) {
        if (n == null || n.isNull() || !n.isTextual()) {
            if (n != null && n.isNumber()) {
                return n.asText();
            }
            return null;
        }
        String t = n.asText();
        return t.isBlank() ? null : t;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String normalizeStatus(String s) {
        if (s == null || s.isBlank()) {
            return "draft";
        }
        String t = s.trim().toLowerCase(Locale.ROOT);
        if ("published".equals(t) || "draft".equals(t) || "proposed".equals(t) || "rejected".equals(t)) {
            return t;
        }
        return "draft";
    }

    private static String slugHandle(String handle, String title) {
        if (handle != null && !handle.isBlank()) {
            return handle.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]+", "-").replaceAll("^-|-$", "");
        }
        String base = title.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        return base.isBlank() ? "product-" + UUID.randomUUID().toString().substring(0, 8) : base;
    }

    private static String newEntityId() {
        return UUID.randomUUID().toString();
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) {
            return "product";
        }
        return name.replaceAll("[^a-zA-Z0-9_]", "");
    }

    private static String sanitizeLower(String name) {
        return sanitize(name).toLowerCase(Locale.ROOT);
    }
}
