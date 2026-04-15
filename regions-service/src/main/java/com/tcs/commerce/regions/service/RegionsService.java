package com.tcs.commerce.regions.service;

import com.tcs.commerce.regions.config.RegionsProperties;
import com.tcs.commerce.regions.web.CountryDto;
import com.tcs.commerce.regions.web.RegionDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Reads region and country from the same Medusa DB. Exposes list and get-by-id for Store API compatibility.
 */
@Service
public class RegionsService {

    private final JdbcTemplate jdbc;
    private final RegionsProperties props;

    public RegionsService(JdbcTemplate jdbc, RegionsProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    private String regionTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        return schema + "." + props.getRegionTable();
    }

    private String countryTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        return schema + "." + props.getCountryTable();
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /** List all regions with their countries. Compatible with Medusa GET /store/regions. */
    public List<RegionDto> listRegions() {
        String rTable = regionTable();
        String cTable = countryTable();
        List<RegionDto> regions = new ArrayList<>();
        try {
            // Query region: id, name, currency_code, automatic_taxes, metadata, created_at, updated_at
            String regionSql = "SELECT id, name, currency_code, automatic_taxes, metadata, created_at, updated_at FROM " + rTable + " ORDER BY created_at";
            List<Map<String, Object>> regionRows = jdbc.queryForList(regionSql);
            for (Map<String, Object> row : regionRows) {
                String regionId = str(row.get("id"));
                if (regionId == null) continue;
                List<CountryDto> countries = getCountriesForRegion(regionId, cTable);
                RegionDto dto = mapToRegion(row, countries);
                regions.add(dto);
            }
        } catch (Exception e) {
            // Table or column might not exist; return empty
            return List.of();
        }
        return regions;
    }

    /** Get one region by id. Compatible with Medusa GET /store/regions/:id. */
    public RegionDto getRegionById(String id) {
        if (id == null || id.isBlank()) return null;
        String rTable = regionTable();
        String cTable = countryTable();
        try {
            String sql = "SELECT id, name, currency_code, automatic_taxes, metadata, created_at, updated_at FROM " + rTable + " WHERE id = ? LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, id.trim());
            if (rows.isEmpty()) return null;
            List<CountryDto> countries = getCountriesForRegion(id.trim(), cTable);
            return mapToRegion(rows.get(0), countries);
        } catch (Exception e) {
            return null;
        }
    }

    private List<CountryDto> getCountriesForRegion(String regionId, String cTable) {
        List<CountryDto> list = new ArrayList<>();
        try {
            // Medusa: country table often has region_id; some schemas use region_id column name
            String sql = "SELECT iso_2, iso_3, name, display_name, num_code FROM " + cTable + " WHERE region_id = ? ORDER BY iso_2";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, regionId);
            for (Map<String, Object> row : rows) {
                list.add(new CountryDto(
                    str(row.get("iso_2")),
                    str(row.get("iso_3")),
                    str(row.get("name")),
                    str(row.get("display_name")),
                    str(row.get("num_code"))
                ));
            }
        } catch (Exception ignored) {
            // country table or region_id column may not exist
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private RegionDto mapToRegion(Map<String, Object> row, List<CountryDto> countries) {
        String id = str(row.get("id"));
        String name = str(row.get("name"));
        String currencyCode = str(row.get("currency_code"));
        if (currencyCode != null) currencyCode = currencyCode.toLowerCase();
        Boolean automaticTaxes = row.get("automatic_taxes") instanceof Boolean b ? b : null;
        Map<String, Object> metadata = row.get("metadata") instanceof Map ? (Map<String, Object>) row.get("metadata") : null;
        String createdAt = row.get("created_at") != null ? row.get("created_at").toString() : null;
        String updatedAt = row.get("updated_at") != null ? row.get("updated_at").toString() : null;
        return new RegionDto(
            id,
            name,
            currencyCode != null ? currencyCode : "usd",
            automaticTaxes,
            countries.isEmpty() ? List.of() : countries,
            metadata,
            createdAt,
            updatedAt
        );
    }
}
