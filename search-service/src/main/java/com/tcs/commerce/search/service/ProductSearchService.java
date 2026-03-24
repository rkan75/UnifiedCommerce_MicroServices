package com.tcs.commerce.search.service;

import com.tcs.commerce.search.config.SearchProperties;
import com.tcs.commerce.search.web.ProductDto;
import com.tcs.commerce.search.web.SearchResponse;
import com.tcs.commerce.search.web.VariantDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Read-only search over Medusa product table.
 * Uses configurable table name (app.search.product-table). Query is text-only on title/description
 * so it works with minimal schema. Price filter can be applied by the storefront after fetching
 * full product+price from Medusa for returned IDs, or add a DB view with min_price (see README).
 */
@Service
public class ProductSearchService {

    private final JdbcTemplate jdbc;
    private final SearchProperties props;

    public ProductSearchService(JdbcTemplate jdbc, SearchProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    /**
     * Search products by text (title/description). Optional priceMin/priceMax are applied in-memory
     * only if the query returns a min_price_cents column (e.g. from a view); otherwise ignored.
     */
    public SearchResponse search(String q, Double priceMin, Double priceMax, String regionId,
                                 String categoryId, String collectionId, int limit, int offset) {
        int safeLimit = Math.min(Math.max(1, limit), props.getMaxLimit());
        int safeOffset = Math.max(0, offset);

        String productTable = sanitizeIdentifier(props.getProductTable());
        boolean useAlias = (categoryId != null && !categoryId.isBlank()) || (collectionId != null && !collectionId.isBlank());
        String fromClause = useAlias
            ? "FROM " + productTable + " p WHERE p.deleted_at IS NULL "
            : "FROM " + productTable + " WHERE deleted_at IS NULL ";
        String selectColumns = useAlias ? "p.id, p.title, p.handle, p.description, p.thumbnail, p.status, p.metadata, p.created_at " : "id, title, handle, description, thumbnail, status, metadata, created_at ";

        StringBuilder where = new StringBuilder();
        where.append(fromClause);

        List<Object> params = new ArrayList<>();
        if (q != null && !q.trim().isEmpty()) {
            String colPrefix = useAlias ? "p." : "";
            String[] words = q.trim().toLowerCase().split("\\s+");
            for (String word : words) {
                String w = word.replace("%", "\\%").replace("_", "\\_");
                where.append("AND (LOWER(").append(colPrefix).append("title) LIKE ? OR LOWER(COALESCE(").append(colPrefix).append("description, '')) LIKE ?) ");
                params.add("%" + w + "%");
                params.add("%" + w + "%");
            }
        }
        if (categoryId != null && !categoryId.isBlank()) {
            String rawLinkTable = props.getProductCategoryLinkTable() != null && !props.getProductCategoryLinkTable().isBlank() ? props.getProductCategoryLinkTable() : "product_category_product";
            String rawCategoryCol = props.getProductCategoryLinkTableCategoryColumn() != null && !props.getProductCategoryLinkTableCategoryColumn().isBlank() ? props.getProductCategoryLinkTableCategoryColumn() : "product_category_id";
            String linkTable = sanitizeLower(rawLinkTable);
            String categoryCol = sanitizeLower(rawCategoryCol);
            where.append("AND EXISTS (SELECT 1 FROM ").append(linkTable).append(" pcp WHERE pcp.product_id = p.id AND pcp.").append(categoryCol).append(" = ?) ");
            params.add(categoryId.trim());
        }
        if (collectionId != null && !collectionId.isBlank()) {
            where.append("AND p.collection_id = ? ");
            params.add(collectionId.trim());
        }

        String countSql = "SELECT COUNT(*) " + where;
        Long total;
        try {
            total = jdbc.queryForObject(countSql, Long.class, params.toArray());
        } catch (Exception e) {
            total = 0L;
        }
        if (total == null) total = 0L;

        String dataSql = "SELECT " + selectColumns + where + "ORDER BY " + (useAlias ? "p.created_at" : "created_at") + " DESC LIMIT ? OFFSET ?";
        List<Object> dataParams = new ArrayList<>(params);
        dataParams.add(safeLimit);
        dataParams.add(safeOffset);

        List<Map<String, Object>> rows = jdbc.queryForList(dataSql, dataParams.toArray());
        List<ProductDto> products = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            String id = getString(row, "id");
            List<VariantDto> variants = List.of(
                new VariantDto(id + "_v", getString(row, "title"), null, null)
            );
            ProductDto dto = ProductDto.of(
                id,
                getString(row, "title"),
                getString(row, "handle"),
                getString(row, "description"),
                getString(row, "thumbnail"),
                getString(row, "status"),
                variants,
                row.get("metadata")
            );
            products.add(dto);
        }

        return SearchResponse.of(products, total);
    }

    /**
     * Get a single product by ID (e.g. prod_xxx). Returns product with variants and optional prices.
     * Used by admin price-update search and any client that needs product-by-ID from the search service.
     */
    public SearchResponse getById(String productId) {
        if (productId == null || productId.isBlank()) {
            return SearchResponse.of(List.of(), 0);
        }
        String productTable = sanitizeIdentifier(props.getProductTable());
        String variantTable = sanitizeIdentifier(props.getVariantTable());

        String productSql = "SELECT id, title, handle, description, thumbnail, status, metadata, created_at FROM "
            + productTable + " WHERE id = ? AND deleted_at IS NULL";
        List<Map<String, Object>> productRows = jdbc.queryForList(productSql, productId);
        if (productRows.isEmpty()) {
            return SearchResponse.of(List.of(), 0);
        }

        Map<String, Object> row = productRows.get(0);
        String id = getString(row, "id");
        List<VariantDto> variants = getVariantsForProduct(variantTable, id);
        if (variants.isEmpty()) {
            variants = List.of(new VariantDto(id + "_v", getString(row, "title"), null, null));
        }
        ProductDto product = ProductDto.of(
            id,
            getString(row, "title"),
            getString(row, "handle"),
            getString(row, "description"),
            getString(row, "thumbnail"),
            getString(row, "status"),
            variants,
            row.get("metadata")
        );
        return SearchResponse.of(List.of(product), 1);
    }

    private List<VariantDto> getVariantsForProduct(String variantTable, String productId) {
        String sql = "SELECT id, title, sku FROM " + variantTable
            + " WHERE product_id = ? AND deleted_at IS NULL";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, productId);
        List<VariantDto> variants = new ArrayList<>();
        for (Map<String, Object> vRow : rows) {
            String variantId = getString(vRow, "id");
            Map<String, Object> calculatedPrice = resolveVariantPrice(variantId);
            variants.add(new VariantDto(
                variantId,
                getString(vRow, "title"),
                getString(vRow, "sku"),
                calculatedPrice
            ));
        }
        return variants;
    }

    /**
     * Resolve calculated_price for a variant (amount, currency_code). Medusa v2: price_set_money_amount.
     * Returns null if table/column missing or no price found.
     */
    private Map<String, Object> resolveVariantPrice(String variantId) {
        try {
            String variantTable = sanitizeIdentifier(props.getVariantTable());
            String sql = "SELECT psma.amount, psma.currency_code FROM " + variantTable + " v "
                + "JOIN price_set_money_amount psma ON psma.price_set_id = v.price_set_id "
                + "WHERE v.id = ? AND v.deleted_at IS NULL LIMIT 1";
            List<Map<String, Object>> priceRows = jdbc.queryForList(sql, variantId);
            if (!priceRows.isEmpty()) {
                Map<String, Object> r = priceRows.get(0);
                Object amt = r.get("amount");
                Long amount = amt instanceof Number ? ((Number) amt).longValue() : null;
                String currency = getString(r, "currency_code");
                if (amount != null) {
                    Map<String, Object> price = new HashMap<>();
                    price.put("amount", amount);
                    price.put("currency_code", currency != null ? currency : "usd");
                    return price;
                }
            }
        } catch (Exception ignored) {
            // Table or column may not exist
        }
        return null;
    }

    private static String getString(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v != null ? v.toString() : null;
    }

    private static String sanitizeIdentifier(String name) {
        if (name == null || name.isBlank()) return "product";
        return name.replaceAll("[^a-zA-Z0-9_]", "");
    }

    /** Sanitize and lowercase for SQL identifiers (table/column names). */
    private static String sanitizeLower(String name) {
        if (name == null || name.isBlank()) return "product";
        return sanitizeIdentifier(name).toLowerCase();
    }
}
