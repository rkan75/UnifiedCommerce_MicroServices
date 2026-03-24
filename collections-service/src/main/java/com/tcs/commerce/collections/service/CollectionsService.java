package com.tcs.commerce.collections.service;

import com.tcs.commerce.collections.config.CollectionsProperties;
import com.tcs.commerce.collections.web.CollectionDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Reads product_collection from the same Medusa DB. Exposes list, get-by-id, and get-by-handle for Store API compatibility.
 */
@Service
public class CollectionsService {

    private final JdbcTemplate jdbc;
    private final CollectionsProperties props;

    public CollectionsService(JdbcTemplate jdbc, CollectionsProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    private String table() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getTable() != null && !props.getTable().isBlank()) ? props.getTable().trim() : "product_collection";
        return schema + "." + tbl.replaceAll("[^a-zA-Z0-9_]", "");
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /** List collections with limit/offset. Compatible with Medusa GET /store/collections. */
    public List<CollectionDto> listCollections(Integer limit, Integer offset) {
        String tbl = table();
        int safeLimit = limit != null && limit > 0 && limit <= 500 ? limit : 100;
        int safeOffset = offset != null && offset >= 0 ? offset : 0;
        try {
            String sql = "SELECT id, title, handle, created_at, updated_at, metadata FROM " + tbl
                + " WHERE (deleted_at IS NULL OR deleted_at > NOW()) ORDER BY created_at DESC LIMIT ? OFFSET ?";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, safeLimit, safeOffset);
            return rows.stream().map(this::mapRow).filter(dto -> dto != null).toList();
        } catch (Exception e) {
            try {
                String sql = "SELECT id, title, handle, created_at, updated_at FROM " + tbl + " ORDER BY created_at DESC LIMIT ? OFFSET ?";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, safeLimit, safeOffset);
                return rows.stream().map(this::mapRow).filter(dto -> dto != null).toList();
            } catch (Exception e2) {
                try {
                    String sql = "SELECT id, name, handle, created_at, updated_at FROM " + tbl + " ORDER BY created_at DESC LIMIT ? OFFSET ?";
                    List<Map<String, Object>> rows = jdbc.queryForList(sql, safeLimit, safeOffset);
                    return rows.stream().map(this::mapRowFromName).filter(dto -> dto != null).toList();
                } catch (Exception e3) {
                    return List.of();
                }
            }
        }
    }

    /** Get collection by id. Compatible with Medusa GET /store/collections/:id. */
    public CollectionDto getCollectionById(String id) {
        if (id == null || id.isBlank()) return null;
        String tbl = table();
        try {
            String sql = "SELECT id, title, handle, created_at, updated_at, metadata FROM " + tbl + " WHERE id = ? AND (deleted_at IS NULL OR deleted_at > NOW()) LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, id.trim());
            if (rows.isEmpty()) return null;
            return mapRow(rows.get(0));
        } catch (Exception e) {
            try {
                String sql = "SELECT id, title, handle, created_at, updated_at FROM " + tbl + " WHERE id = ? LIMIT 1";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, id.trim());
                if (rows.isEmpty()) return null;
                return mapRow(rows.get(0));
            } catch (Exception e2) {
                try {
                    String sql = "SELECT id, name, handle, created_at, updated_at FROM " + tbl + " WHERE id = ? LIMIT 1";
                    List<Map<String, Object>> rows = jdbc.queryForList(sql, id.trim());
                    if (rows.isEmpty()) return null;
                    return mapRowFromName(rows.get(0));
                } catch (Exception e3) {
                    return null;
                }
            }
        }
    }

    /** Get collection by handle. Used by storefront for /collections/[handle]. */
    public CollectionDto getCollectionByHandle(String handle) {
        if (handle == null || handle.isBlank()) return null;
        String tbl = table();
        String h = handle.trim();
        try {
            String sql = "SELECT id, title, handle, created_at, updated_at, metadata FROM " + tbl
                + " WHERE LOWER(TRIM(handle)) = LOWER(?) AND (deleted_at IS NULL OR deleted_at > NOW()) LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, h);
            if (rows.isEmpty()) return null;
            return mapRow(rows.get(0));
        } catch (Exception e) {
            try {
                String sql = "SELECT id, title, handle, created_at, updated_at FROM " + tbl + " WHERE LOWER(TRIM(handle)) = LOWER(?) LIMIT 1";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, h);
                if (rows.isEmpty()) return null;
                return mapRow(rows.get(0));
            } catch (Exception e2) {
                try {
                    String sql = "SELECT id, name, handle, created_at, updated_at FROM " + tbl + " WHERE LOWER(TRIM(handle)) = LOWER(?) LIMIT 1";
                    List<Map<String, Object>> rows = jdbc.queryForList(sql, h);
                    if (rows.isEmpty()) return null;
                    return mapRowFromName(rows.get(0));
                } catch (Exception e3) {
                    return null;
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private CollectionDto mapRow(Map<String, Object> row) {
        String id = str(row.get("id"));
        if (id == null) return null;
        String title = str(row.get("title"));
        String handle = str(row.get("handle"));
        String createdAt = row.get("created_at") != null ? row.get("created_at").toString() : null;
        String updatedAt = row.get("updated_at") != null ? row.get("updated_at").toString() : null;
        Map<String, Object> metadata = row.get("metadata") instanceof Map ? (Map<String, Object>) row.get("metadata") : null;
        return new CollectionDto(id, title, handle, createdAt, updatedAt, metadata);
    }

    @SuppressWarnings("unchecked")
    private CollectionDto mapRowFromName(Map<String, Object> row) {
        String id = str(row.get("id"));
        if (id == null) return null;
        String title = str(row.get("name"));
        String handle = str(row.get("handle"));
        String createdAt = row.get("created_at") != null ? row.get("created_at").toString() : null;
        String updatedAt = row.get("updated_at") != null ? row.get("updated_at").toString() : null;
        Map<String, Object> metadata = row.get("metadata") instanceof Map ? (Map<String, Object>) row.get("metadata") : null;
        return new CollectionDto(id, title, handle, createdAt, updatedAt, metadata);
    }
}
