package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import com.tcs.commerce.products.web.*;
import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Reads products and variants from the catalog database.
 * Returns a storefront-compatible product list response.
 */
@Service
public class ProductsService {

    private static final Logger log = LoggerFactory.getLogger(ProductsService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final ObjectMapper objectMapper;
    private final NativeProductOptionService nativeProductOptionService;
    private final CatalogSchemaCache schemaCache;

    public ProductsService(
        JdbcTemplate jdbc,
        ProductsProperties props,
        ObjectMapper objectMapper,
        NativeProductOptionService nativeProductOptionService,
        CatalogSchemaCache schemaCache
    ) {
        this.jdbc = jdbc;
        this.props = props;
        this.objectMapper = objectMapper;
        this.nativeProductOptionService = nativeProductOptionService;
        this.schemaCache = schemaCache;
    }

    @PostConstruct
    void logStorefrontTypeScope() {
        String tid = configuredStorefrontTypeId();
        if (tid != null) {
            log.info(
                "[products-service] Default catalog type CATALOG_DEFAULT_PRODUCT_TYPE_ID={} (used when request omits type_id)",
                tid
            );
        }
    }

    /** Non-null trimmed id when {@link ProductsProperties#getDefaultProductTypeId()} is set. */
    private String configuredStorefrontTypeId() {
        String raw = props.getDefaultProductTypeId();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    /**
     * Effective {@code type_id} for SQL: explicit request {@code type_id} wins (admin filters, deep links);
     * when absent, optional env {@code CATALOG_DEFAULT_PRODUCT_TYPE_ID} scopes the storefront catalog unless
     * {@code skipDefaultProductTypeScope} is true (admin list / export without type filter must see all products).
     */
    private String resolveEffectiveTypeId(String requestTypeId, boolean skipDefaultProductTypeScope) {
        if (requestTypeId != null && !requestTypeId.isBlank()) {
            return requestTypeId.trim();
        }
        if (skipDefaultProductTypeScope) {
            return null;
        }
        return configuredStorefrontTypeId();
    }

    /**
     * List products with optional filters: handle, id(s), q (search), category_id, category_handle, collection_id, region_id, type_id.
     * When category_handle is set and category_id is blank, resolves category_id from product_category table by handle.
     */
    public ProductsResponse getProducts(
        String handle,
        List<String> ids,
        String q,
        String categoryId,
        String categoryHandle,
        String collectionId,
        String regionId,
        String typeId,
        Integer limit,
        Integer offset,
        String status,
        String tag,
        String salesChannelId,
        String createdAfter,
        String createdBefore,
        String updatedAfter,
        String updatedBefore,
        String order,
        boolean skipDefaultProductTypeScope
    ) {
        // Prefer resolving category_id from category_handle so filtering works even when link table uses ids from same DB
        String resolvedCategoryId = categoryId;
        if (categoryHandle != null && !categoryHandle.isBlank()) {
            String byHandle = resolveCategoryIdByHandle(categoryHandle.trim());
            if (byHandle != null) {
                resolvedCategoryId = byHandle;
            }
        }
        categoryId = resolvedCategoryId;

        boolean hasCategoryFilter = categoryId != null && !categoryId.isBlank();
        boolean hasCollectionFilter = collectionId != null && !collectionId.isBlank();

        String effectiveTypeId = resolveEffectiveTypeId(typeId, skipDefaultProductTypeScope);

        // 1) Try link table first (product_category_product). Never fall back to an unfiltered list when the
        // shopper asked for a category/collection — that surfaced as "category page shows all products" on SQL/config errors.
        ProductsResponse withFilter;
        try {
            withFilter = getProductsInternal(handle, ids, q, categoryId, collectionId, regionId, effectiveTypeId, limit, offset, status, tag, salesChannelId, createdAfter, createdBefore, updatedAfter, updatedBefore, order, true);
        } catch (Exception e) {
            log.error(
                "[products-service] Filtered product query failed (category_id={}, collection_id={})",
                categoryId,
                collectionId,
                e
            );
            throw e;
        }

        if (!hasCategoryFilter && !hasCollectionFilter) {
            return withFilter;
        }

        long count = withFilter.count();
        if (count > 0) {
            return withFilter;
        }

        // 2) Link table returned 0: try direct product.category_id (some schemas have this column)
        if (hasCategoryFilter) {
            try {
                ProductsResponse direct = getProductsInternal(handle, ids, q, categoryId, collectionId, regionId, effectiveTypeId, limit, offset, status, tag, salesChannelId, createdAfter, createdBefore, updatedAfter, updatedBefore, order, false);
                if (direct.count() > 0) {
                    return direct;
                }
            } catch (Exception ignored) {
                // column may not exist
            }
        }

        // Return the filtered result (possibly 0 products). Do NOT fall back to unfiltered when user selected a category.
        return withFilter;
    }

    /**
     * @param useCategoryLinkTable when true and categoryId set, use EXISTS (product_category_product); when false, use p.category_id = ?
     */
    private ProductsResponse getProductsInternal(
        String handle,
        List<String> ids,
        String q,
        String categoryId,
        String collectionId,
        String regionId,
        String typeId,
        Integer limit,
        Integer offset,
        String status,
        String tag,
        String salesChannelId,
        String createdAfter,
        String createdBefore,
        String updatedAfter,
        String updatedBefore,
        String order,
        boolean useCategoryLinkTable
    ) {
        int safeLimit = limit != null && limit > 0
            ? Math.min(limit, props.getMaxLimit())
            : props.getDefaultLimit();
        int safeOffset = Math.max(0, offset != null ? offset : 0);
        String productTable = sanitize(props.getProductTable());
        String variantTable = sanitize(props.getVariantTable());
        boolean joinProductType = productTypeJoinEnabled();

        StringBuilder fromWhere = new StringBuilder();
        fromWhere.append(" FROM ").append(productTable).append(" p ");
        if (joinProductType) {
            fromWhere.append(" LEFT JOIN ").append(sanitize(props.getProductTypeTable())).append(" pt ON pt.id = p.type_id ");
        }
        fromWhere.append(" WHERE p.deleted_at IS NULL ");
        List<Object> params = new ArrayList<>();

        if (handle != null && !handle.isBlank()) {
            fromWhere.append(" AND p.handle = ? ");
            params.add(handle.trim());
        }
        if (ids != null && !ids.isEmpty()) {
            fromWhere.append(" AND p.id IN (").append(String.join(",", Collections.nCopies(ids.size(), "?"))).append(") ");
            params.addAll(ids);
        }
        if (categoryId != null && !categoryId.isBlank()) {
            if (useCategoryLinkTable) {
                String rawLinkTable = props.getProductCategoryLinkTable() != null && !props.getProductCategoryLinkTable().isBlank() ? props.getProductCategoryLinkTable() : "product_category_product";
                String rawCategoryCol = props.getProductCategoryLinkTableCategoryColumn() != null && !props.getProductCategoryLinkTableCategoryColumn().isBlank() ? props.getProductCategoryLinkTableCategoryColumn() : "product_category_id";
                String linkTable = sanitizeLower(rawLinkTable);
                String categoryCol = sanitizeLower(rawCategoryCol);
                fromWhere.append(" AND EXISTS (SELECT 1 FROM ").append(linkTable).append(" pcl WHERE pcl.product_id = p.id AND pcl.").append(categoryCol).append(" = ?) ");
                params.add(categoryId.trim());
            } else {
                fromWhere.append(" AND p.category_id = ? ");
                params.add(categoryId.trim());
            }
        }
        if (collectionId != null && !collectionId.isBlank()) {
            fromWhere.append(" AND p.collection_id = ? ");
            params.add(collectionId.trim());
        }
        if (typeId != null && !typeId.isBlank()) {
            fromWhere.append(" AND p.type_id = ? ");
            params.add(typeId.trim());
        }
        if (q != null && !q.trim().isEmpty()) {
            appendProductTextSearch(fromWhere, params, q);
        }
        if (status != null && !status.isBlank()) {
            fromWhere.append(" AND LOWER(COALESCE(p.status,'')) = LOWER(?) ");
            params.add(status.trim());
        }
        appendProductTagFilter(fromWhere, params, tag);
        String linkTable = props.getProductSalesChannelLinkTable();
        if (salesChannelId != null && !salesChannelId.isBlank()
            && linkTable != null && !linkTable.isBlank()) {
            String lt = sanitizeLower(linkTable);
            fromWhere.append(" AND EXISTS (SELECT 1 FROM ").append(lt)
                .append(" psc WHERE psc.product_id = p.id AND psc.sales_channel_id = ? AND psc.deleted_at IS NULL) ");
            params.add(salesChannelId.trim());
        }
        if (createdAfter != null && !createdAfter.isBlank()) {
            fromWhere.append(" AND p.created_at >= ?::date ");
            params.add(createdAfter.trim());
        }
        if (createdBefore != null && !createdBefore.isBlank()) {
            fromWhere.append(" AND p.created_at < (?::date + interval '1 day') ");
            params.add(createdBefore.trim());
        }
        if (updatedAfter != null && !updatedAfter.isBlank()) {
            fromWhere.append(" AND p.updated_at >= ?::date ");
            params.add(updatedAfter.trim());
        }
        if (updatedBefore != null && !updatedBefore.isBlank()) {
            fromWhere.append(" AND p.updated_at < (?::date + interval '1 day') ");
            params.add(updatedBefore.trim());
        }

        String orderColumn = "created_at";
        String orderDir = "DESC";
        if (order != null && !order.isBlank()) {
            String col = order.startsWith("-") ? order.substring(1) : order;
            if ("title".equalsIgnoreCase(col)
                || "handle".equalsIgnoreCase(col)
                || "created_at".equalsIgnoreCase(col)
                || "updated_at".equalsIgnoreCase(col)) {
                orderColumn = col.toLowerCase();
            }
            orderDir = order.startsWith("-") ? "DESC" : "ASC";
        }

        String countSql = "SELECT COUNT(*) " + fromWhere;
        List<Object> dataParams = new ArrayList<>(params);
        dataParams.add(safeLimit);
        dataParams.add(safeOffset);

        String orderClause = " ORDER BY p." + orderColumn + " " + orderDir + " LIMIT ? OFFSET ?";
        String typeSelect = joinProductType ? ", pt.id AS type_row_id, pt.value AS type_row_value" : "";
        String dataSqlWithMeta = "SELECT p.id, p.title, p.handle, p.description, p.thumbnail, p.status, p.metadata, p.collection_id, p.created_at, p.updated_at" + typeSelect + " " + fromWhere + orderClause;
        String dataSqlNoMeta = "SELECT p.id, p.title, p.handle, p.description, p.thumbnail, p.status, p.collection_id, p.created_at, p.updated_at" + typeSelect + " " + fromWhere + orderClause;

        // Debug: log SQL when filtering by category (always at INFO when category filter is on; set log level to DEBUG for params too)
        if (categoryId != null && !categoryId.isBlank()) {
            log.info("[products-service] Category filter: category_id={} | COUNT query: {}", categoryId, countSql);
            log.info("[products-service] Category filter: DATA query: {}", dataSqlWithMeta);
            if (log.isDebugEnabled()) {
                log.debug("[products-service] Category filter params: countParams={}, dataParams={}", params, dataParams);
            }
        }

        Long total = jdbc.queryForObject(countSql, Long.class, params.toArray());
        if (total == null) total = 0L;

        List<Map<String, Object>> productRows;
        try {
            productRows = jdbc.queryForList(dataSqlWithMeta, dataParams.toArray());
        } catch (Exception e) {
            try {
                productRows = jdbc.queryForList(dataSqlNoMeta, dataParams.toArray());
            } catch (Exception e2) {
                throw e;
            }
        }

        List<ProductDto> products = new ArrayList<>();
        for (Map<String, Object> row : productRows) {
            String productId = getString(row, "id");
            List<ProductVariantDto> variants = getVariantsForProduct(variantTable, productId, regionId);
            if (variants.isEmpty()) {
                variants = List.of(new ProductVariantDto(
                    productId + "_default",
                    getString(row, "title"),
                    null,
                    null
                ));
            }
            Object metadata = null;
            try {
                metadata = row.get("metadata");
            } catch (Exception ignored) {
                // some drivers return JSONB in a way that fails get(); ignore
            }
            // Product options: native option tables when present and populated; else metadata + synthetic "Type"
            List<ProductOptionDto> productOptions;
            if (nativeProductOptionService.nativeTablesPresent()) {
                List<ProductOptionDto> dbOpts = nativeProductOptionService.loadProductOptions(productId);
                if (!dbOpts.isEmpty()) {
                    productOptions = dbOpts;
                    List<String> vidList = variants.stream().map(ProductVariantDto::id).toList();
                    Map<String, Map<String, String>> matrix =
                        nativeProductOptionService.loadVariantOptionMatrix(vidList);
                    variants = variants.stream()
                        .map(v -> nativeProductOptionService.attachVariantOptions(v, dbOpts, matrix))
                        .collect(Collectors.toList());
                } else {
                    List<ProductOptionDto> syntheticOpts = buildSyntheticOptions(variants);
                    List<ProductOptionDto> adminOpts = parseAdminProductOptionsFromMetadata(metadata);
                    productOptions = mergeProductOptions(adminOpts, syntheticOpts);
                    variants = variants.stream()
                        .map(v -> attachVariantOptions(v, productOptions))
                        .collect(Collectors.toList());
                }
            } else {
                List<ProductOptionDto> syntheticOpts = buildSyntheticOptions(variants);
                List<ProductOptionDto> adminOpts = parseAdminProductOptionsFromMetadata(metadata);
                productOptions = mergeProductOptions(adminOpts, syntheticOpts);
                variants = variants.stream()
                    .map(v -> attachVariantOptions(v, productOptions))
                    .collect(Collectors.toList());
            }
            variants = enrichVariantsWithInventory(variants);
            ProductTypeDto typeDto = null;
            if (joinProductType) {
                String tid = getString(row, "type_row_id");
                if (tid != null && !tid.isBlank()) {
                    typeDto = new ProductTypeDto(tid, getString(row, "type_row_value"));
                }
            }
            List<ProductImageDto> productImages = buildProductImages(
                productId,
                getString(row, "thumbnail"),
                variantTable
            );
            ProductDto dto = new ProductDto(
                productId,
                getString(row, "title"),
                getString(row, "handle"),
                getString(row, "description"),
                getString(row, "thumbnail"),
                getString(row, "status"),
                typeDto,
                variants,
                productImages.isEmpty() ? null : productImages,
                productOptions.isEmpty() ? null : productOptions,
                metadata,
                getString(row, "collection_id")
            );
            products.add(dto);
        }

        return ProductsResponse.of(products, total);
    }

    /**
     * Free-text search: match the full phrase (contiguous) or, for multi-word queries, require every word to appear somewhere
     * in the concatenation of title, handle, and description. Uses {@code POSITION(... IN ...)} so multi-token queries are not
     * broken by {@code ILIKE} / {@code ESCAPE} edge cases and {@code %}/{@code _} in input stay literal.
     */
    private void appendProductTextSearch(StringBuilder fromWhere, List<Object> params, String q) {
        String normalized = normalizeProductSearchQuery(q);
        if (normalized.isEmpty()) {
            return;
        }
        List<String> wordList = new ArrayList<>();
        for (String w : normalized.toLowerCase(Locale.ROOT).split(" ")) {
            if (!w.isEmpty()) {
                wordList.add(w);
            }
        }
        if (wordList.isEmpty()) {
            return;
        }
        String haystack = "LOWER(CONCAT_WS(' ', COALESCE(p.title,''), COALESCE(p.handle,''), COALESCE(p.description::text,'')))";
        String phraseLower = normalized.toLowerCase(Locale.ROOT);
        fromWhere.append(" AND ( POSITION(LOWER(?) IN ").append(haystack).append(") > 0 ");
        params.add(phraseLower);
        if (wordList.size() > 1) {
            // Primary multi-word match: all tokens must appear somewhere in the concatenated haystack.
            // Fallback multi-word match: if that is too strict for some data shapes, accept any token.
            fromWhere.append(" OR ((");
            for (int i = 0; i < wordList.size(); i++) {
                if (i > 0) {
                    fromWhere.append(" AND ");
                }
                fromWhere.append("POSITION(LOWER(?) IN ").append(haystack).append(") > 0");
                params.add(wordList.get(i));
            }
            fromWhere.append(") OR (");
            for (int i = 0; i < wordList.size(); i++) {
                if (i > 0) {
                    fromWhere.append(" OR ");
                }
                fromWhere.append("POSITION(LOWER(?) IN ").append(haystack).append(") > 0");
                params.add(wordList.get(i));
            }
            fromWhere.append(")) ");
        }
        fromWhere.append(") ");
    }

    private static String normalizeProductSearchQuery(String q) {
        if (q == null) {
            return "";
        }
        String t = q.trim().replace('\u00a0', ' ');
        return t.replaceAll("\\s+", " ");
    }

    /**
     * Tag filter: {@code product.metadata}-&gt;{@code tags} JSON array (same source as {@link #listDistinctTagsFromMetadata()}),
     * optionally OR relational {@code product_tag} link when {@link ProductsProperties#getProductTagLinkTable()} is set.
     */
    private void appendProductTagFilter(StringBuilder fromWhere, List<Object> params, String tag) {
        if (tag == null || tag.isBlank()) {
            return;
        }
        String trimmed = tag.trim();
        fromWhere.append(" AND (");
        // Single jsonb arg: COALESCE must wrap (metadata -> 'tags'), not split jsonb_array_elements_text into two args.
        fromWhere.append(
            "EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE((COALESCE((p.metadata)::jsonb, '{}'::jsonb)) -> 'tags', '[]'::jsonb)) AS _tagmeta(v) "
                + "WHERE lower(btrim(_tagmeta.v, ' \t\n\r\"')) = lower(btrim(?, ' \t\n\r\"')))"
        );
        params.add(trimmed);
        String linkTable = props.getProductTagLinkTable();
        if (linkTable != null && !linkTable.isBlank()) {
            String lt = sanitizeLower(linkTable);
            String tagTable = sanitizeLower(props.getProductTagTable());
            String tagIdCol = sanitizeLower(props.getProductTagIdColumn());
            String tagValCol = sanitizeLower(props.getProductTagValueColumn());
            String lp = sanitizeLower(props.getProductTagLinkProductColumn());
            String ltag = sanitizeLower(props.getProductTagLinkTagColumn());
            fromWhere.append(" OR EXISTS (SELECT 1 FROM ")
                .append(lt)
                .append(" pl INNER JOIN ")
                .append(tagTable)
                .append(" tg ON tg.")
                .append(tagIdCol)
                .append(" = pl.")
                .append(ltag)
                .append(" AND tg.deleted_at IS NULL WHERE pl.")
                .append(lp)
                .append(" = p.id AND lower(btrim(tg.")
                .append(tagValCol)
                .append("::text, ' \t\n\r')) = lower(btrim(?, ' \t\n\r')))");
            params.add(trimmed);
        }
        fromWhere.append(") ");
    }

    private boolean productTypeJoinEnabled() {
        String t = props.getProductTypeTable();
        return t != null && !t.isBlank();
    }

    /** When {@link #configuredStorefrontTypeId()} is set, product must have that {@code product.type_id}. */
    private boolean isProductInStorefrontCatalog(String productId) {
        String tid = configuredStorefrontTypeId();
        if (tid == null) {
            return true;
        }
        if (productId == null || productId.isBlank()) {
            return false;
        }
        String pt = sanitize(props.getProductTable());
        try {
            List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT type_id FROM " + pt + " WHERE id = ? AND deleted_at IS NULL",
                productId.trim()
            );
            if (r.isEmpty()) {
                return false;
            }
            String type = getString(r.get(0), "type_id");
            return tid.equals(type == null ? "" : type.trim());
        } catch (Exception e) {
            log.debug("[products-service] Could not resolve product type for id={}: {}", productId, e.getMessage());
            return false;
        }
    }

    /**
     * @return {@code null} when no storefront type restriction (all variant rows allowed); otherwise product ids allowed
     */
    private Set<String> resolveProductIdsMatchingStorefrontType(List<Map<String, Object>> variantRows) {
        String tid = configuredStorefrontTypeId();
        if (tid == null) {
            return null;
        }
        Set<String> pids = new HashSet<>();
        for (Map<String, Object> row : variantRows) {
            String pid = getString(row, "product_id");
            if (pid != null && !pid.isBlank()) {
                pids.add(pid.trim());
            }
        }
        if (pids.isEmpty()) {
            return Set.of();
        }
        String pt = sanitize(props.getProductTable());
        String placeholders = String.join(",", Collections.nCopies(pids.size(), "?"));
        List<Object> args = new ArrayList<>(pids);
        args.add(tid);
        try {
            List<Map<String, Object>> prows = jdbc.queryForList(
                "SELECT id FROM " + pt + " WHERE id IN (" + placeholders + ") AND deleted_at IS NULL AND type_id = ?",
                args.toArray()
            );
            Set<String> allowed = new HashSet<>();
            for (Map<String, Object> r : prows) {
                String id = getString(r, "id");
                if (id != null && !id.isBlank()) {
                    allowed.add(id.trim());
                }
            }
            return allowed;
        } catch (Exception e) {
            log.debug("[products-service] Batch product type filter failed: {}", e.getMessage());
            return Set.of();
        }
    }

    /**
     * Distinct category ids linked to at least one non-deleted product of {@code typeId} (category link table + product join).
     * Used by the storefront instead of paginating through every product to build nav scope.
     */
    public List<String> listDistinctCategoryIdsForProductType(String typeId) {
        if (typeId == null || typeId.isBlank()) {
            return List.of();
        }
        String linkTable = sanitizeLower(
            props.getProductCategoryLinkTable() != null && !props.getProductCategoryLinkTable().isBlank()
                ? props.getProductCategoryLinkTable()
                : "product_category_product"
        );
        String categoryCol = sanitizeLower(
            props.getProductCategoryLinkTableCategoryColumn() != null
                && !props.getProductCategoryLinkTableCategoryColumn().isBlank()
                ? props.getProductCategoryLinkTableCategoryColumn()
                : "product_category_id"
        );
        String productTable = sanitize(props.getProductTable());
        String sql = "SELECT DISTINCT pcl." + categoryCol + " AS cid FROM " + linkTable
            + " pcl INNER JOIN " + productTable + " p ON p.id = pcl.product_id "
            + "WHERE p.deleted_at IS NULL AND p.type_id = ?";
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(sql, typeId.trim());
            List<String> out = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                String id = getString(row, "cid");
                if (id != null && !id.isBlank()) {
                    out.add(id.trim());
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("[products-service] listDistinctCategoryIdsForProductType failed: {}", e.getMessage());
            throw e;
        }
    }

    /**
     * Distinct non-null {@code product.collection_id} values for products of {@code typeId}.
     */
    public List<String> listDistinctCollectionIdsForProductType(String typeId) {
        if (typeId == null || typeId.isBlank()) {
            return List.of();
        }
        String productTable = sanitize(props.getProductTable());
        String sql = "SELECT DISTINCT p.collection_id AS cid FROM " + productTable + " p "
            + "WHERE p.deleted_at IS NULL AND p.type_id = ? AND p.collection_id IS NOT NULL";
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(sql, typeId.trim());
            List<String> out = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                String id = getString(row, "cid");
                if (id != null && !id.isBlank()) {
                    out.add(id.trim());
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("[products-service] listDistinctCollectionIdsForProductType failed: {}", e.getMessage());
            throw e;
        }
    }

    private List<ProductVariantDto> getVariantsForProduct(String variantTable, String productId, String regionId) {
        String vt = variantTable.trim();
        boolean hasThumb = schemaCache.hasColumn(vt, "thumbnail");
        boolean hasMeta = schemaCache.hasColumn(vt, "metadata");
        boolean hasDel = schemaCache.hasColumn(vt, "deleted_at");
        boolean hasMi = schemaCache.hasColumn(vt, "manage_inventory");
        boolean hasBo = schemaCache.hasColumn(vt, "allow_backorder");
        boolean hasIq = schemaCache.hasColumn(vt, "inventory_quantity");
        boolean hasCa = schemaCache.hasColumn(vt, "created_at");
        boolean hasUa = schemaCache.hasColumn(vt, "updated_at");

        StringBuilder sel = new StringBuilder("SELECT id, title, sku");
        if (hasThumb) {
            sel.append(", thumbnail");
        }
        if (hasMeta) {
            sel.append(", metadata");
        }
        if (hasMi) {
            sel.append(", manage_inventory");
        }
        if (hasBo) {
            sel.append(", allow_backorder");
        }
        if (hasIq) {
            sel.append(", inventory_quantity");
        }
        if (hasCa) {
            sel.append(", created_at");
        }
        if (hasUa) {
            sel.append(", updated_at");
        }
        sel.append(" FROM ").append(vt).append(" WHERE product_id = ?");
        if (hasDel) {
            sel.append(" AND deleted_at IS NULL");
        }

        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList(sel.toString(), productId);
        } catch (Exception e) {
            log.debug("[products-service] variant dynamic select failed, using fallback: {}", e.getMessage());
            rows = queryVariantRowsFallback(vt, productId);
        }
        List<ProductVariantDto> variants = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String variantId = getString(row, "id");
            String title = getString(row, "title");
            String sku = getString(row, "sku");
            String vThumb = hasThumb ? getString(row, "thumbnail") : null;
            if (vThumb != null && vThumb.isBlank()) {
                vThumb = null;
            }
            CalculatedPriceDto price = resolveVariantPrice(variantId, regionId);
            Object meta = null;
            if (hasMeta) {
                try {
                    meta = row.get("metadata");
                } catch (Exception ignored) {
                    // metadata may be unavailable in some schemas
                }
            }
            Boolean manageInv = hasMi ? getBooleanObject(row.get("manage_inventory")) : false;
            Boolean allowBo = hasBo ? getBooleanObject(row.get("allow_backorder")) : false;
            if (manageInv == null) {
                manageInv = false;
            }
            if (allowBo == null) {
                allowBo = false;
            }
            Integer invQty = hasIq ? getIntegerObject(row.get("inventory_quantity")) : null;
            String createdIso = hasCa ? formatVariantInstant(row.get("created_at")) : null;
            String updatedIso = hasUa ? formatVariantInstant(row.get("updated_at")) : null;
            variants.add(new ProductVariantDto(
                variantId,
                title,
                sku,
                vThumb,
                price,
                null,
                manageInv,
                allowBo,
                invQty,
                meta,
                createdIso,
                updatedIso
            ));
        }
        return variants;
    }

    private List<Map<String, Object>> queryVariantRowsFallback(String variantTable, String productId) {
        try {
            return jdbc.queryForList(
                "SELECT id, title, sku, thumbnail, metadata FROM " + variantTable + " WHERE product_id = ? AND deleted_at IS NULL",
                productId
            );
        } catch (Exception e) {
            try {
                return jdbc.queryForList(
                    "SELECT id, title, sku, metadata FROM " + variantTable + " WHERE product_id = ? AND deleted_at IS NULL",
                    productId
                );
            } catch (Exception e2) {
                return jdbc.queryForList(
                    "SELECT id, title, sku FROM " + variantTable + " WHERE product_id = ? AND deleted_at IS NULL",
                    productId
                );
            }
        }
    }

    /**
     * Resolves {@code inventory_quantity} for storefront badges: Medusa v2 stores stock in {@code inventory_level},
     * while {@code product_variant.inventory_quantity} is often unset. Sums {@code stocked - reserved} per variant
     * when inventory tables exist; otherwise keeps the column value or 0 when {@code manage_inventory} is true.
     */
    private List<ProductVariantDto> enrichVariantsWithInventory(List<ProductVariantDto> variants) {
        if (variants == null || variants.isEmpty()) {
            return variants;
        }
        boolean useMedusaLevels =
            schemaCache.hasTable("product_variant_inventory_item") && schemaCache.hasTable("inventory_level");
        List<String> managedIds = variants.stream()
            .filter(v -> Boolean.TRUE.equals(v.manage_inventory()))
            .map(ProductVariantDto::id)
            .filter(id -> id != null && !id.isBlank())
            .toList();
        Map<String, Integer> fromLevels =
            useMedusaLevels && !managedIds.isEmpty() ? loadAvailableStockByVariantIds(managedIds) : Map.of();
        return variants.stream()
            .map(v -> {
                if (!Boolean.TRUE.equals(v.manage_inventory())) {
                    return v;
                }
                int q;
                if (!fromLevels.isEmpty() && fromLevels.containsKey(v.id())) {
                    q = fromLevels.get(v.id());
                } else if (v.inventory_quantity() != null) {
                    q = v.inventory_quantity();
                } else {
                    q = 0;
                }
                return new ProductVariantDto(
                    v.id(),
                    v.title(),
                    v.sku(),
                    v.thumbnail(),
                    v.calculated_price(),
                    v.options(),
                    v.manage_inventory(),
                    v.allow_backorder(),
                    q,
                    v.metadata(),
                    v.created_at(),
                    v.updated_at()
                );
            })
            .toList();
    }

    /**
     * Per-variant available quantity: sum over all locations of max(0, stocked_quantity - reserved_quantity).
     */
    private Map<String, Integer> loadAvailableStockByVariantIds(List<String> variantIds) {
        if (variantIds == null || variantIds.isEmpty()) {
            return Map.of();
        }
        String pvi = sanitize("product_variant_inventory_item");
        String il = sanitize("inventory_level");
        if (!schemaCache.hasTable(pvi) || !schemaCache.hasTable(il)) {
            return Map.of();
        }
        String placeholders = String.join(",", Collections.nCopies(variantIds.size(), "?"));
        String sql =
            "SELECT pvi.variant_id, "
                + "COALESCE(SUM(GREATEST(COALESCE(il.stocked_quantity, 0) - COALESCE(il.reserved_quantity, 0), 0)), 0) AS avail "
                + "FROM "
                + pvi
                + " pvi INNER JOIN "
                + il
                + " il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL "
                + "WHERE pvi.deleted_at IS NULL AND pvi.variant_id IN ("
                + placeholders
                + ") GROUP BY pvi.variant_id";
        try {
            return jdbc.query(
                sql,
                rs -> {
                    Map<String, Integer> m = new HashMap<>();
                    while (rs.next()) {
                        String vid = rs.getString(1);
                        BigDecimal bd = rs.getBigDecimal(2);
                        int q = 0;
                        if (bd != null) {
                            q = bd.compareTo(BigDecimal.valueOf(Integer.MAX_VALUE)) > 0
                                ? Integer.MAX_VALUE
                                : Math.max(0, bd.intValue());
                        }
                        if (vid != null && !vid.isBlank()) {
                            m.put(vid, q);
                        }
                    }
                    return m;
                },
                variantIds.toArray());
        } catch (Exception e) {
            log.debug("[products-service] loadAvailableStockByVariantIds: {}", e.getMessage());
            return Map.of();
        }
    }

    private static Integer getIntegerObject(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Number n) {
            long v = n.longValue();
            if (v > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            if (v < Integer.MIN_VALUE) {
                return Integer.MIN_VALUE;
            }
            return (int) v;
        }
        String s = o.toString().trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Boolean getBooleanObject(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Boolean b) {
            return b;
        }
        if (o instanceof Number n) {
            return n.intValue() != 0;
        }
        String s = o.toString().trim();
        if (s.equalsIgnoreCase("t") || s.equalsIgnoreCase("true") || s.equals("1")) {
            return true;
        }
        if (s.equalsIgnoreCase("f") || s.equalsIgnoreCase("false") || s.equals("0")) {
            return false;
        }
        return null;
    }

    private static String formatVariantInstant(Object o) {
        if (o == null) {
            return null;
        }
        try {
            if (o instanceof Timestamp ts) {
                return ts.toInstant().toString();
            }
            if (o instanceof OffsetDateTime odt) {
                return odt.toInstant().toString();
            }
            if (o instanceof Instant ins) {
                return ins.toString();
            }
            if (o instanceof java.util.Date d) {
                return d.toInstant().toString();
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    /** Synthetic option "Type" with values = variant titles so PDP can show variant selector and match selected variant. */
    private static List<ProductOptionDto> buildSyntheticOptions(List<ProductVariantDto> variants) {
        if (variants == null || variants.isEmpty()) return List.of();
        List<String> values = variants.stream()
            .map(v -> v.title() != null && !v.title().isBlank() ? v.title() : "Default")
            .distinct()
            .toList();
        if (values.isEmpty()) return List.of();
        return List.of(new ProductOptionDto("type", "Type", values));
    }

    /**
     * Reads {@code metadata.admin_product_options} after admin PATCH. JDBC often returns jsonb as {@link String}
     * or {@link PGobject}, not a {@link Map}, so we normalize to {@link JsonNode} first.
     */
    private List<ProductOptionDto> parseAdminProductOptionsFromMetadata(Object metadata) {
        if (metadata == null) {
            return List.of();
        }
        try {
            JsonNode root = metadataToJsonNode(metadata);
            if (root == null || !root.isObject()) {
                return List.of();
            }
            JsonNode arr = root.get("admin_product_options");
            if (arr == null || !arr.isArray() || arr.isEmpty()) {
                return List.of();
            }
            List<ProductOptionDto> out = new ArrayList<>();
            for (JsonNode item : arr) {
                if (item == null || !item.isObject()) {
                    continue;
                }
                String title = jsonNodeTextTrim(item.get("title"));
                if (title.isBlank()) {
                    continue;
                }
                String id = jsonNodeTextTrim(item.get("id"));
                if (id.isBlank()) {
                    id = title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
                    if (id.isBlank()) {
                        id = "option";
                    }
                }
                List<String> values = new ArrayList<>();
                JsonNode vals = item.get("values");
                if (vals != null && vals.isArray()) {
                    for (JsonNode v : vals) {
                        if (v == null || v.isNull()) {
                            continue;
                        }
                        String sv = jsonNodeTextTrim(v);
                        if (!sv.isBlank()) {
                            values.add(sv);
                        }
                    }
                }
                out.add(new ProductOptionDto(id, title, List.copyOf(values)));
            }
            return out;
        } catch (Exception e) {
            log.warn("[products-service] parseAdminProductOptionsFromMetadata: {}", e.getMessage());
            return List.of();
        }
    }

    private JsonNode metadataToJsonNode(Object metadata) throws Exception {
        if (metadata instanceof JsonNode j) {
            return j;
        }
        if (metadata instanceof String s) {
            if (s.isBlank() || "null".equalsIgnoreCase(s)) {
                return null;
            }
            return objectMapper.readTree(s);
        }
        if (metadata instanceof PGobject pg) {
            String val = pg.getValue();
            if (val == null || val.isBlank()) {
                return null;
            }
            return objectMapper.readTree(val);
        }
        if (metadata instanceof Map<?, ?>) {
            return objectMapper.valueToTree(metadata);
        }
        return null;
    }

    private static String jsonNodeTextTrim(JsonNode n) {
        if (n == null || n.isNull() || n.isMissingNode()) {
            return "";
        }
        return n.asText().trim();
    }

    /**
     * Admin options first, then synthetic ones. If an admin option shares the same {@code id} as a synthetic option
     * (e.g. both {@code type}), <strong>merge value lists</strong> so variant-derived titles are not lost.
     */
    private static List<ProductOptionDto> mergeProductOptions(List<ProductOptionDto> admin, List<ProductOptionDto> synthetic) {
        List<ProductOptionDto> a = admin == null ? List.of() : admin;
        List<ProductOptionDto> syn = synthetic == null ? List.of() : synthetic;
        if (a.isEmpty()) {
            return syn.isEmpty() ? List.of() : new ArrayList<>(syn);
        }
        if (syn.isEmpty()) {
            return new ArrayList<>(a);
        }
        List<ProductOptionDto> out = new ArrayList<>(a);
        Map<String, Integer> indexById = new LinkedHashMap<>();
        for (int i = 0; i < out.size(); i++) {
            String id = out.get(i).id();
            if (id != null && !id.isBlank()) {
                indexById.put(id.toLowerCase(Locale.ROOT), i);
            }
        }
        for (ProductOptionDto s : syn) {
            String sid = s.id();
            if (sid == null || sid.isBlank()) {
                continue;
            }
            String sidKey = sid.toLowerCase(Locale.ROOT);
            Integer idx = indexById.get(sidKey);
            if (idx == null) {
                out.add(s);
            } else {
                ProductOptionDto existing = out.get(idx);
                List<String> merged = mergeDistinctOptionValues(existing.values(), s.values());
                ProductOptionDto combined = new ProductOptionDto(existing.id(), existing.title(), merged);
                out.set(idx, combined);
            }
        }
        return out;
    }

    private static List<String> mergeDistinctOptionValues(List<String> a, List<String> b) {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        if (a != null) {
            for (String s : a) {
                if (s != null && !s.trim().isEmpty()) {
                    set.add(s.trim());
                }
            }
        }
        if (b != null) {
            for (String s : b) {
                if (s != null && !s.trim().isEmpty()) {
                    set.add(s.trim());
                }
            }
        }
        return new ArrayList<>(set);
    }

    /** Each variant exposes a value for every product option (storefront selector). */
    private ProductVariantDto attachVariantOptions(ProductVariantDto v, List<ProductOptionDto> productOptions) {
        if (productOptions == null || productOptions.isEmpty()) {
            return new ProductVariantDto(
                v.id(),
                v.title(),
                v.sku(),
                v.thumbnail(),
                v.calculated_price(),
                List.of(),
                v.manage_inventory(),
                v.allow_backorder(),
                v.inventory_quantity(),
                v.metadata(),
                v.created_at(),
                v.updated_at()
            );
        }
        Map<String, String> metaVals = parseVariantAdminOptionValues(v.metadata());
        List<VariantOptionDto> opts = new ArrayList<>();
        for (ProductOptionDto po : productOptions) {
            String oid = po.id();
            if (oid == null || oid.isBlank()) {
                continue;
            }
            String oidKey = oid.toLowerCase(Locale.ROOT);
            String displayVal;
            if ("type".equals(oidKey)) {
                displayVal = v.title() != null && !v.title().isBlank() ? v.title() : "Default";
            } else {
                displayVal = metaVals.get(oidKey);
                if (displayVal == null || displayVal.isBlank()) {
                    displayVal = matchVariantTitleToOptionValues(v.title(), po.values());
                }
                if (displayVal == null || displayVal.isBlank()) {
                    displayVal = "—";
                }
            }
            opts.add(new VariantOptionDto(oid, displayVal));
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

    /** Optional: {@code variant.metadata.admin_option_values} as { "option_id": "chosen value" }. */
    private Map<String, String> parseVariantAdminOptionValues(Object metadata) {
        Map<String, String> out = new LinkedHashMap<>();
        if (metadata == null) {
            return out;
        }
        try {
            JsonNode root = metadataToJsonNode(metadata);
            if (root == null || !root.isObject()) {
                return out;
            }
            JsonNode ov = root.get("admin_option_values");
            if (ov == null || !ov.isObject()) {
                return out;
            }
            ov.fields().forEachRemaining(e -> {
                String k = e.getKey();
                JsonNode val = e.getValue();
                if (k != null && !k.isBlank() && val != null && val.isTextual()) {
                    String t = val.asText().trim();
                    if (!t.isEmpty()) {
                        out.put(k.toLowerCase(Locale.ROOT), t);
                    }
                }
            });
        } catch (Exception ignored) {
            // ignore
        }
        return out;
    }

    private static String matchVariantTitleToOptionValues(String variantTitle, List<String> optionValues) {
        if (variantTitle == null || optionValues == null || optionValues.isEmpty()) {
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
     * Collects image URLs persisted for a product: {@code product.thumbnail}, {@code product_image}+{@code image},
     * optional {@code image.product_id}, {@code product_variant.thumbnail}, and {@code product_variant_image}+{@code image}.
     */
    private List<ProductImageDto> buildProductImages(String productId, String productThumbnail, String variantTableSanitized) {
        if (productId == null || productId.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<String> ordered = new ArrayList<>();
        java.util.function.Consumer<String> add = s -> {
            if (s == null) {
                return;
            }
            String t = s.trim();
            if (t.isEmpty()) {
                return;
            }
            if (seen.add(t)) {
                ordered.add(t);
            }
        };
        add.accept(productThumbnail);
        String pid = productId.trim();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT i.url AS url FROM product_image pi JOIN image i ON i.id = pi.image_id "
                    + "WHERE pi.product_id = ? ORDER BY pi.rank ASC NULLS LAST, pi.id ASC LIMIT 64",
                pid
            );
            for (Map<String, Object> r : rows) {
                Object u = r.get("url");
                if (u != null) {
                    add.accept(u.toString());
                }
            }
        } catch (Exception e) {
            log.debug("[products-service] product_image join: {}", e.getMessage());
        }
        if (ordered.size() <= 1) {
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT url FROM image WHERE product_id = ? ORDER BY rank ASC NULLS LAST, id ASC LIMIT 64",
                    pid
                );
                for (Map<String, Object> r : rows) {
                    Object u = r.get("url");
                    if (u != null) {
                        add.accept(u.toString());
                    }
                }
            } catch (Exception e) {
                log.debug("[products-service] image by product_id: {}", e.getMessage());
            }
        }
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT DISTINCT thumbnail AS url FROM " + variantTableSanitized
                    + " WHERE product_id = ? AND deleted_at IS NULL AND thumbnail IS NOT NULL "
                    + "AND btrim(thumbnail::text) <> ''",
                pid
            );
            for (Map<String, Object> r : rows) {
                Object u = r.get("url");
                if (u != null) {
                    add.accept(u.toString());
                }
            }
        } catch (Exception e) {
            log.debug("[products-service] variant thumbnails: {}", e.getMessage());
        }
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT DISTINCT i.url AS url FROM product_variant_image pvi "
                    + "JOIN image i ON i.id = pvi.image_id JOIN " + variantTableSanitized
                    + " pv ON pv.id = pvi.variant_id "
                    + "WHERE pv.product_id = ? AND pv.deleted_at IS NULL "
                    + "ORDER BY pvi.rank ASC NULLS LAST, pvi.id ASC NULLS LAST LIMIT 64",
                pid
            );
            for (Map<String, Object> r : rows) {
                Object u = r.get("url");
                if (u != null) {
                    add.accept(u.toString());
                }
            }
        } catch (Exception e) {
            try {
                List<Map<String, Object>> rows2 = jdbc.queryForList(
                    "SELECT DISTINCT i.url AS url FROM product_variant_image pvi "
                        + "JOIN image i ON i.id = pvi.image_id JOIN " + variantTableSanitized
                        + " pv ON pv.id = pvi.variant_id WHERE pv.product_id = ? AND pv.deleted_at IS NULL LIMIT 64",
                    pid
                );
                for (Map<String, Object> r : rows2) {
                    Object u = r.get("url");
                    if (u != null) {
                        add.accept(u.toString());
                    }
                }
            } catch (Exception e2) {
                log.debug("[products-service] product_variant_image: {}", e2.getMessage());
            }
        }
        List<ProductImageDto> out = new ArrayList<>();
        for (String u : ordered) {
            out.add(new ProductImageDto(u));
        }
        return out;
    }

    /**
     * Resolve category id from product_category table by handle (e.g. "produce" -> id).
     * Returns null if not found or table missing.
     */
    private String resolveCategoryIdByHandle(String categoryHandle) {
        if (categoryHandle == null || categoryHandle.isBlank()) return null;
        String tbl = sanitize(props.getProductCategoryTable() != null && !props.getProductCategoryTable().isBlank() ? props.getProductCategoryTable() : "product_category");
        try {
            String sql = "SELECT id FROM " + tbl + " WHERE LOWER(TRIM(handle)) = LOWER(?) LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, categoryHandle.trim());
            if (!rows.isEmpty()) {
                String id = getString(rows.get(0), "id");
                return (id != null && !id.isBlank()) ? id.trim() : null;
            }
        } catch (Exception ignored) {
            // table or column may not exist
        }
        return null;
    }

    /**
     * Get region's {@code currency_code} from the region table (pricing context).
     * Returns null if region_id is blank or table/column missing.
     */
    private String getRegionCurrencyCode(String regionId) {
        if (regionId == null || regionId.isBlank()) return null;
        String regionTable = sanitize(props.getRegionTable());
        try {
            String sql = "SELECT currency_code FROM " + regionTable + " WHERE id = ? LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, regionId.trim());
            if (!rows.isEmpty()) {
                String cc = getString(rows.get(0), "currency_code");
                return (cc != null && !cc.isBlank()) ? cc.trim().toLowerCase() : null;
            }
        } catch (Exception ignored) {
            // Region table or column may not exist
        }
        return null;
    }

    /**
     * Resolve calculated_price for a variant using catalog price tables:
     * - Use region_id to get region's currency_code (context).
     * - From variant's price_set, pick the best-matching price (prefer currency match).
     * Tries multiple known catalog schemas so variant price is picked up when present in DB.
     */
    private CalculatedPriceDto resolveVariantPrice(String variantId, String regionId) {
        String preferredCurrency = getRegionCurrencyCode(regionId);
        CalculatedPriceDto dto;
        dto = resolveVariantPriceFromPriceSetMoneyAmount(variantId, preferredCurrency, false);
        if (dto != null) return dto;
        dto = resolveVariantPriceFromPriceSetMoneyAmount(variantId, preferredCurrency, true);
        if (dto != null) return dto;
        dto = resolveVariantPriceFromPriceTable(variantId, preferredCurrency);
        if (dto != null) return dto;
        dto = resolveVariantPriceViaLinkTable(variantId, preferredCurrency);
        return dto;
    }

    /** Extract amount as long (minor units). Handles BigDecimal, Number, String from PostgreSQL. */
    private static Long extractAmount(Object amt) {
        if (amt == null) return null;
        if (amt instanceof BigDecimal) return ((BigDecimal) amt).longValue();
        if (amt instanceof Number) return ((Number) amt).longValue();
        try {
            return Long.parseLong(amt.toString().trim());
        } catch (NumberFormatException e) {
            try {
                return (long) Double.parseDouble(amt.toString().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
    }

    /**
     * Schema 1: amount on price_set_money_amount. Schema 2: amount on money_amount (join via money_amount_id).
     */
    private CalculatedPriceDto resolveVariantPriceFromPriceSetMoneyAmount(String variantId, String preferredCurrency, boolean useMoneyAmountTable) {
        String variantTable = sanitize(props.getVariantTable());
        try {
            String sql;
            Object[] params;
            if (useMoneyAmountTable) {
                sql = "SELECT ma.amount, ma.currency_code FROM " + variantTable
                    + " v JOIN price_set_money_amount psma ON psma.price_set_id = v.price_set_id "
                    + "JOIN money_amount ma ON ma.id = psma.money_amount_id "
                    + "WHERE v.id = ? AND v.deleted_at IS NULL ";
            } else {
                sql = "SELECT psma.amount, psma.currency_code FROM " + variantTable
                    + " v JOIN price_set_money_amount psma ON psma.price_set_id = v.price_set_id "
                    + "WHERE v.id = ? AND v.deleted_at IS NULL ";
            }
            if (preferredCurrency != null && !preferredCurrency.isBlank()) {
                String alias = useMoneyAmountTable ? "ma" : "psma";
                sql += "ORDER BY CASE WHEN LOWER(TRIM(" + alias + ".currency_code)) = ? THEN 0 ELSE 1 END ";
            }
            sql += "LIMIT 1";
            params = preferredCurrency != null && !preferredCurrency.isBlank()
                ? new Object[]{variantId, preferredCurrency}
                : new Object[]{variantId};
            List<Map<String, Object>> priceRows = jdbc.queryForList(sql, params);
            return mapRowToCalculatedPrice(priceRows);
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Schema 3: {@code price} table (price_set_id, amount, currency_code).
     */
    private CalculatedPriceDto resolveVariantPriceFromPriceTable(String variantId, String preferredCurrency) {
        String variantTable = sanitize(props.getVariantTable());
        try {
            String sql = "SELECT p.amount, p.currency_code FROM " + variantTable + " v "
                + "JOIN price p ON p.price_set_id = v.price_set_id "
                + "WHERE v.id = ? AND v.deleted_at IS NULL ";
            if (preferredCurrency != null && !preferredCurrency.isBlank()) {
                sql += "ORDER BY CASE WHEN LOWER(TRIM(p.currency_code)) = ? THEN 0 ELSE 1 END ";
            }
            sql += "LIMIT 1";
            Object[] params = preferredCurrency != null && !preferredCurrency.isBlank()
                ? new Object[]{variantId, preferredCurrency}
                : new Object[]{variantId};
            List<Map<String, Object>> priceRows = jdbc.queryForList(sql, params);
            return mapRowToCalculatedPrice(priceRows);
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Schema 4: Variant linked to price_set via link table (e.g. product_variant_price_set with variant_id, price_set_id).
     */
    private CalculatedPriceDto resolveVariantPriceViaLinkTable(String variantId, String preferredCurrency) {
        try {
            String sql = "SELECT p.amount, p.currency_code FROM product_variant_price_set link "
                + "JOIN price p ON p.price_set_id = link.price_set_id "
                + "WHERE link.variant_id = ? ";
            if (preferredCurrency != null && !preferredCurrency.isBlank()) {
                sql += "ORDER BY CASE WHEN LOWER(TRIM(p.currency_code)) = ? THEN 0 ELSE 1 END ";
            }
            sql += "LIMIT 1";
            Object[] params = preferredCurrency != null && !preferredCurrency.isBlank()
                ? new Object[]{variantId, preferredCurrency}
                : new Object[]{variantId};
            List<Map<String, Object>> priceRows = jdbc.queryForList(sql, params);
            return mapRowToCalculatedPrice(priceRows);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static CalculatedPriceDto mapRowToCalculatedPrice(List<Map<String, Object>> priceRows) {
        if (priceRows == null || priceRows.isEmpty()) return null;
        Map<String, Object> r = priceRows.get(0);
        Long amount = extractAmount(r.get("amount"));
        if (amount == null) return null;
        String currency = getString(r, "currency_code");
        String currencyCode = (currency != null && !currency.isBlank()) ? currency.trim() : "usd";
        return new CalculatedPriceDto(amount, currencyCode, amount, null);
    }

    /**
     * Get a single variant by id. Returns null if not found.
     */
    public VariantResponseDto getVariantById(String variantId, String regionId) {
        if (variantId == null || variantId.isBlank()) return null;
        String variantTable = sanitize(props.getVariantTable());
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList("SELECT id, product_id, title, sku, metadata FROM " + variantTable + " WHERE id = ? AND deleted_at IS NULL", variantId);
        } catch (Exception e) {
            rows = jdbc.queryForList("SELECT id, product_id, title, sku FROM " + variantTable + " WHERE id = ? AND deleted_at IS NULL", variantId);
        }
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        String id = getString(row, "id");
        String productId = getString(row, "product_id");
        if (!isProductInStorefrontCatalog(productId)) {
            return null;
        }
        CalculatedPriceDto price = resolveVariantPrice(id, regionId);
        Object meta = null;
        try { meta = row.get("metadata"); } catch (Exception ignored) { }
        return new VariantResponseDto(id, productId, getString(row, "title"), getString(row, "sku"), price, meta);
    }

    /**
     * Get multiple variants by id. Returns list in requested order; missing variants omitted.
     */
    public List<VariantResponseDto> getVariantsByIds(List<String> variantIds, String regionId) {
        if (variantIds == null || variantIds.isEmpty()) return List.of();
        String variantTable = sanitize(props.getVariantTable());
        String placeholders = String.join(",", Collections.nCopies(variantIds.size(), "?"));
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList("SELECT id, product_id, title, sku, metadata FROM " + variantTable + " WHERE id IN (" + placeholders + ") AND deleted_at IS NULL", variantIds.toArray());
        } catch (Exception e) {
            rows = jdbc.queryForList("SELECT id, product_id, title, sku FROM " + variantTable + " WHERE id IN (" + placeholders + ") AND deleted_at IS NULL", variantIds.toArray());
        }
        Set<String> allowedProductIds = resolveProductIdsMatchingStorefrontType(rows);
        List<VariantResponseDto> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String pid = getString(row, "product_id");
            if (allowedProductIds != null && (pid == null || !allowedProductIds.contains(pid))) {
                continue;
            }
            String id = getString(row, "id");
            CalculatedPriceDto price = resolveVariantPrice(id, regionId);
            Object meta = null;
            try { meta = row.get("metadata"); } catch (Exception ignored) { }
            result.add(new VariantResponseDto(id, getString(row, "product_id"), getString(row, "title"), getString(row, "sku"), price, meta));
        }
        return result;
    }

    /**
     * Facets for admin filter UI: {@code product_type} rows.
     */
    public List<Map<String, String>> listProductTypes() {
        String table = sanitize(props.getProductTypeTable());
        if (table.isBlank()) {
            return List.of();
        }
        try {
            return jdbc.query(
                "SELECT id::text AS id, value FROM " + table + " WHERE deleted_at IS NULL ORDER BY value NULLS LAST LIMIT 500",
                (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("value", rs.getString("value"));
                    return m;
                });
        } catch (Exception e) {
            log.debug("listProductTypes: {}", e.toString());
            return List.of();
        }
    }

    /**
     * Distinct tags for admin UI: {@code product_tag.value}, {@code metadata.tags} JSON array,
     * and tags reachable via the {@code product_tags} pivot (see {@link ProductsProperties#getProductTagLinkTable()}).
     */
    public List<String> listDistinctTags() {
        Map<String, String> byLower = new TreeMap<>();
        mergeTagStrings(byLower, listDistinctTagsFromProductTagMaster());
        mergeTagStrings(byLower, listDistinctTagsFromMetadata());
        mergeTagStrings(byLower, listDistinctTagsFromLinkTable());
        return new ArrayList<>(byLower.values());
    }

    private static void mergeTagStrings(Map<String, String> byLower, List<String> tags) {
        for (String t : tags) {
            if (t == null || t.isBlank()) {
                continue;
            }
            String norm = t.trim();
            byLower.putIfAbsent(norm.toLowerCase(Locale.ROOT), norm);
        }
    }

    /** All tag values from {@code product_tag}, including tags not yet on a product. */
    private List<String> listDistinctTagsFromProductTagMaster() {
        String tagTable = sanitize(props.getProductTagTable());
        if (tagTable.isBlank()) {
            return List.of();
        }
        String tagValCol = sanitizeLower(props.getProductTagValueColumn());
        try {
            return jdbc.query(
                "SELECT DISTINCT trim(both ' ' FROM tg." + tagValCol + ") AS tag FROM "
                    + tagTable
                    + " tg WHERE tg.deleted_at IS NULL AND length(trim(both ' ' FROM tg." + tagValCol + ")) > 0 "
                    + "ORDER BY 1 LIMIT 500",
                (rs, i) -> rs.getString("tag"));
        } catch (Exception e) {
            log.debug("listDistinctTagsFromProductTagMaster: {}", e.toString());
            return List.of();
        }
    }

    private List<String> listDistinctTagsFromMetadata() {
        String pt = sanitize(props.getProductTable());
        try {
            return jdbc.query(
                "SELECT DISTINCT btrim(vals.v, ' \t\n\r\"') AS tag FROM "
                    + pt + " p CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE((COALESCE((p.metadata)::jsonb, '{}'::jsonb)) -> 'tags', '[]'::jsonb)) AS vals(v) "
                    + "WHERE p.deleted_at IS NULL AND length(btrim(vals.v, ' \t\n\r\"')) > 0 "
                    + "ORDER BY 1 LIMIT 400",
                (rs, i) -> rs.getString("tag"));
        } catch (Exception e) {
            log.debug("listDistinctTagsFromMetadata: {}", e.toString());
            return List.of();
        }
    }

    private List<String> listDistinctTagsFromLinkTable() {
        String linkTable = props.getProductTagLinkTable();
        if (linkTable == null || linkTable.isBlank()) {
            return List.of();
        }
        String pt = sanitize(props.getProductTable());
        String lt = sanitizeLower(linkTable);
        String tagTable = sanitizeLower(props.getProductTagTable());
        String tagIdCol = sanitizeLower(props.getProductTagIdColumn());
        String tagValCol = sanitizeLower(props.getProductTagValueColumn());
        String lp = sanitizeLower(props.getProductTagLinkProductColumn());
        String ltag = sanitizeLower(props.getProductTagLinkTagColumn());
        try {
            String sql = "SELECT DISTINCT trim(both ' ' FROM tg." + tagValCol + ") AS tag FROM "
                + lt + " pl INNER JOIN " + tagTable + " tg ON tg." + tagIdCol + " = pl." + ltag
                + " AND tg.deleted_at IS NULL INNER JOIN " + pt + " p ON p.id = pl." + lp + " AND p.deleted_at IS NULL "
                + "WHERE length(trim(both ' ' FROM tg." + tagValCol + ")) > 0 "
                + "ORDER BY 1 LIMIT 400";
            return jdbc.query(sql, (rs, i) -> rs.getString("tag"));
        } catch (Exception e) {
            log.debug("listDistinctTagsFromLinkTable: {}", e.toString());
            return List.of();
        }
    }

    public List<Map<String, String>> listSalesChannels() {
        String st = sanitize(props.getSalesChannelTable());
        try {
            return jdbc.query(
                "SELECT id::text AS id, name FROM " + st + " WHERE deleted_at IS NULL ORDER BY name NULLS LAST LIMIT 200",
                (rs, i) -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("name", rs.getString("name"));
                    return m;
                });
        } catch (Exception e) {
            log.debug("listSalesChannels: {}", e.toString());
            return List.of();
        }
    }

    private static String getString(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v != null ? v.toString() : null;
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) return "product";
        return name.replaceAll("[^a-zA-Z0-9_]", "");
    }

    /** Sanitize and lowercase for SQL identifiers (table/column names). */
    private static String sanitizeLower(String name) {
        if (name == null || name.isBlank()) return "product";
        return sanitize(name).toLowerCase();
    }
}
