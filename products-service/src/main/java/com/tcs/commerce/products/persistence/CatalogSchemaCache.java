package com.tcs.commerce.products.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caches {@code information_schema} column names for catalog tables so inserts work across minor schema variants.
 */
@Component
public class CatalogSchemaCache {

    private final JdbcTemplate jdbc;
    private final ConcurrentHashMap<String, Set<String>> columnsByTable = new ConcurrentHashMap<>();
    /** Lowercase column name → lowercase PostgreSQL {@code udt_name} (e.g. {@code jsonb}, {@code int8}). */
    private final ConcurrentHashMap<String, Map<String, String>> columnUdtByTable = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Boolean> tableExists = new ConcurrentHashMap<>();

    public CatalogSchemaCache(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Set<String> columnsOf(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            return Set.of();
        }
        String key = tableName.trim().toLowerCase(Locale.ROOT);
        return columnsByTable.computeIfAbsent(key, this::loadColumns);
    }

    public boolean hasColumn(String tableName, String columnName) {
        if (columnName == null) {
            return false;
        }
        return columnsOf(tableName).contains(columnName.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * PostgreSQL {@code udt_name} for the column (e.g. {@code jsonb}), or null if unknown.
     * Loads column metadata for the table if not cached yet.
     */
    public String columnUdtName(String tableName, String columnName) {
        if (tableName == null || columnName == null) {
            return null;
        }
        String t = tableName.trim().toLowerCase(Locale.ROOT);
        String c = columnName.trim().toLowerCase(Locale.ROOT);
        columnsOf(tableName);
        Map<String, String> m = columnUdtByTable.get(t);
        return m == null ? null : m.get(c);
    }

    public boolean columnIsJsonb(String tableName, String columnName) {
        return "jsonb".equalsIgnoreCase(columnUdtName(tableName, columnName));
    }

    public boolean hasTable(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            return false;
        }
        String key = tableName.trim().toLowerCase(Locale.ROOT);
        return tableExists.computeIfAbsent(key, this::loadTableExists);
    }

    private Set<String> loadColumns(String tableLower) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
                tableLower
            );
            Map<String, String> udts = new HashMap<>();
            Set<String> names = new HashSet<>();
            for (Map<String, Object> row : rows) {
                Object cn = row.get("column_name");
                Object udt = row.get("udt_name");
                if (cn == null) {
                    continue;
                }
                String c = cn.toString().toLowerCase(Locale.ROOT);
                names.add(c);
                if (udt != null) {
                    udts.put(c, udt.toString().toLowerCase(Locale.ROOT));
                }
            }
            columnUdtByTable.put(tableLower, Collections.unmodifiableMap(udts));
            return Collections.unmodifiableSet(names);
        } catch (Exception e) {
            columnUdtByTable.put(tableLower, Map.of());
            return Set.of();
        }
    }

    private boolean loadTableExists(String tableLower) {
        try {
            Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
                Integer.class,
                tableLower
            );
            return n != null && n > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
