package com.tcs.commerce.products.service;

import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.web.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Reads products and variants from Medusa DB (same as Medusa backend).
 * Returns response shape compatible with Medusa GET /store/products.
 */
@Service
public class ProductsService {

    private static final Logger log = LoggerFactory.getLogger(ProductsService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;

    public ProductsService(JdbcTemplate jdbc, ProductsProperties props) {
        this.jdbc = jdbc;
        this.props = props;
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
        String order
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

        // 1) Try link table first (product_category_product)
        ProductsResponse withFilter = null;
        try {
            withFilter = getProductsInternal(handle, ids, q, categoryId, collectionId, regionId, typeId, limit, offset, order, true);
        } catch (Exception e) {
            if (hasCategoryFilter || hasCollectionFilter) {
                try {
                    return getProductsInternal(handle, ids, q, null, null, regionId, typeId, limit, offset, order, true);
                } catch (Exception ignored) {
                    throw e;
                }
            }
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
                ProductsResponse direct = getProductsInternal(handle, ids, q, categoryId, collectionId, regionId, typeId, limit, offset, order, false);
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
            String[] words = q.trim().toLowerCase().split("\\s+");
            for (String word : words) {
                String w = word.replace("%", "\\%").replace("_", "\\_");
                fromWhere.append(" AND (LOWER(p.title) LIKE ? OR LOWER(COALESCE(p.description,'')) LIKE ?) ");
                params.add("%" + w + "%");
                params.add("%" + w + "%");
            }
        }

        String orderColumn = "created_at";
        String orderDir = "DESC";
        if (order != null && !order.isBlank()) {
            String col = order.startsWith("-") ? order.substring(1) : order;
            if ("title".equalsIgnoreCase(col) || "handle".equalsIgnoreCase(col)) {
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
        String dataSqlWithMeta = "SELECT p.id, p.title, p.handle, p.description, p.thumbnail, p.status, p.metadata, p.created_at" + typeSelect + " " + fromWhere + orderClause;
        String dataSqlNoMeta = "SELECT p.id, p.title, p.handle, p.description, p.thumbnail, p.status, p.created_at" + typeSelect + " " + fromWhere + orderClause;

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
            // Build synthetic product options and variant options for PDP (variant selector + stock)
            List<ProductOptionDto> productOptions = buildSyntheticOptions(variants);
            variants = variants.stream()
                .map(v -> withVariantOptions(v, productOptions))
                .collect(Collectors.toList());
            Object metadata = null;
            try {
                metadata = row.get("metadata");
            } catch (Exception ignored) {
                // some drivers return JSONB in a way that fails get(); ignore
            }
            ProductTypeDto typeDto = null;
            if (joinProductType) {
                String tid = getString(row, "type_row_id");
                if (tid != null && !tid.isBlank()) {
                    typeDto = new ProductTypeDto(tid, getString(row, "type_row_value"));
                }
            }
            ProductDto dto = new ProductDto(
                productId,
                getString(row, "title"),
                getString(row, "handle"),
                getString(row, "description"),
                getString(row, "thumbnail"),
                getString(row, "status"),
                typeDto,
                variants,
                productOptions.isEmpty() ? null : productOptions,
                metadata
            );
            products.add(dto);
        }

        return ProductsResponse.of(products, total);
    }

    private boolean productTypeJoinEnabled() {
        String t = props.getProductTypeTable();
        return t != null && !t.isBlank();
    }

    private List<ProductVariantDto> getVariantsForProduct(String variantTable, String productId, String regionId) {
        String sql = "SELECT id, title, sku FROM " + variantTable + " WHERE product_id = ? AND deleted_at IS NULL";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, productId);
        List<ProductVariantDto> variants = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String variantId = getString(row, "id");
            String title = getString(row, "title");
            String sku = getString(row, "sku");
            CalculatedPriceDto price = resolveVariantPrice(variantId, regionId);
            variants.add(new ProductVariantDto(
                variantId,
                title,
                sku,
                price,
                null,
                false,
                false,
                null,
                null
            ));
        }
        return variants;
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

    /** Add options to variant so storefront can match selectedVariant by option values. */
    private static ProductVariantDto withVariantOptions(ProductVariantDto v, List<ProductOptionDto> productOptions) {
        List<VariantOptionDto> opts = List.of();
        if (productOptions != null && !productOptions.isEmpty()) {
            String value = v.title() != null && !v.title().isBlank() ? v.title() : "Default";
            opts = List.of(new VariantOptionDto("type", value));
        }
        return new ProductVariantDto(
            v.id(),
            v.title(),
            v.sku(),
            v.calculated_price(),
            opts,
            v.manage_inventory(),
            v.allow_backorder(),
            v.inventory_quantity(),
            v.metadata()
        );
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
     * Get region's currency_code from Medusa region table (same as Medusa uses for calculatePrices context).
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
     * Resolve calculated_price for a variant the same way Medusa does:
     * - Use region_id to get region's currency_code (context).
     * - From variant's price_set, pick the best-matching price (prefer currency match).
     * Tries multiple Medusa v2 schemas so variant price is always picked up when present in DB.
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
     * Schema 3: Medusa v2 "price" table (Price model has price_set_id, amount, currency_code).
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
        List<VariantResponseDto> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String id = getString(row, "id");
            CalculatedPriceDto price = resolveVariantPrice(id, regionId);
            Object meta = null;
            try { meta = row.get("metadata"); } catch (Exception ignored) { }
            result.add(new VariantResponseDto(id, getString(row, "product_id"), getString(row, "title"), getString(row, "sku"), price, meta));
        }
        return result;
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
