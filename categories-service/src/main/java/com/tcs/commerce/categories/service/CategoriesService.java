package com.tcs.commerce.categories.service;

import com.tcs.commerce.categories.config.CategoriesProperties;
import com.tcs.commerce.categories.web.ProductCategoryDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;
import java.util.UUID;

/**
 * Reads product_category from the same Medusa DB. Exposes list and get-by-handle for Store API compatibility.
 */
@Service
public class CategoriesService {

    private final JdbcTemplate jdbc;
    private final CategoriesProperties props;

    public CategoriesService(JdbcTemplate jdbc, CategoriesProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    private String table() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = props.getTable() != null && !props.getTable().isBlank() ? props.getTable().trim() : "product_category";
        return schema + "." + tbl.replaceAll("[^a-zA-Z0-9_]", "");
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /** List all product categories (Store API compatible). */
    public List<ProductCategoryDto> listCategories(Integer limit) {
        String tbl = table();
        int safeLimit = limit != null && limit > 0 && limit <= 500 ? limit : 100;
        try {
            String sql = "SELECT id, name, handle, description, parent_category_id, rank, is_active, metadata, created_at, updated_at FROM " + tbl + " ORDER BY name LIMIT ?";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, safeLimit);
            return rows.stream().map(this::mapRow).filter(Objects::nonNull).collect(Collectors.toList());
        } catch (Exception e) {
            try {
                String sql = "SELECT id, name, handle, description, parent_category_id FROM " + tbl + " ORDER BY name LIMIT ?";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, safeLimit);
                return rows.stream().map(this::mapRow).filter(Objects::nonNull).collect(Collectors.toList());
            } catch (Exception e2) {
                return List.of();
            }
        }
    }

    /** Get categories by handle (exact or path like "produce/dairy"). Returns first match. */
    public List<ProductCategoryDto> getCategoriesByHandle(String handle) {
        if (handle == null || handle.isBlank()) return List.of();
        String tbl = table();
        String normalized = handle.trim().toLowerCase();
        String lastSegment = normalized.contains("/") ? normalized.substring(normalized.lastIndexOf('/') + 1) : normalized;
        try {
            String sql = "SELECT id, name, handle, description, parent_category_id, rank, is_active, metadata, created_at, updated_at FROM " + tbl
                + " WHERE LOWER(TRIM(handle)) = ? OR LOWER(TRIM(handle)) = ? LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, normalized, lastSegment);
            return rows.stream().map(this::mapRow).filter(Objects::nonNull).collect(Collectors.toList());
        } catch (Exception e) {
            try {
                String sql = "SELECT id, name, handle, description, parent_category_id FROM " + tbl
                    + " WHERE LOWER(TRIM(handle)) = ? OR LOWER(TRIM(handle)) = ? LIMIT 1";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, normalized, lastSegment);
                return rows.stream().map(this::mapRow).filter(Objects::nonNull).collect(Collectors.toList());
            } catch (Exception e2) {
                return List.of();
            }
        }
    }

    /** Create a category (for scripts; replaces Medusa createProductCategories). */
    public ProductCategoryDto createCategory(String name, String handle, Boolean isActive) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("name required");
        String tbl = table();
        String id = "pc_" + UUID.randomUUID().toString().replace("-", "");
        String h = (handle != null && !handle.isBlank()) ? handle.trim() : name.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-");
        boolean active = isActive != null ? isActive : true;
        try {
            jdbc.update(
                "INSERT INTO " + tbl + " (id, name, handle, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
                id, name.trim(), h, active
            );
        } catch (Exception e) {
            try {
                jdbc.update(
                    "INSERT INTO " + tbl + " (id, name, handle, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
                    id, name.trim(), h
                );
            } catch (Exception e2) {
                throw new IllegalStateException("Failed to create category: " + e2.getMessage(), e2);
            }
        }
        return mapFromCreated(id, name.trim(), h, active);
    }

    private ProductCategoryDto mapFromCreated(String id, String name, String handle, boolean isActive) {
        return new ProductCategoryDto(id, name, handle, null, null, null, null, null, isActive, null, null, null);
    }

    private ProductCategoryDto mapRow(Map<String, Object> row) {
        String id = str(row.get("id"));
        if (id == null) return null;
        String name = str(row.get("name"));
        String handle = str(row.get("handle"));
        String description = str(row.get("description"));
        String parentId = str(row.get("parent_category_id"));
        Integer rank = row.get("rank") instanceof Number n ? n.intValue() : null;
        Boolean isActive = row.get("is_active") instanceof Boolean b ? b : true;
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = row.get("metadata") instanceof Map ? (Map<String, Object>) row.get("metadata") : null;
        String createdAt = row.get("created_at") != null ? row.get("created_at").toString() : null;
        String updatedAt = row.get("updated_at") != null ? row.get("updated_at").toString() : null;
        return new ProductCategoryDto(id, name, handle, description, parentId, null, null, rank, isActive, metadata, createdAt, updatedAt);
    }
}
