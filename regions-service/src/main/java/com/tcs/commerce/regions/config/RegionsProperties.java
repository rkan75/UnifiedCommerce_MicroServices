package com.tcs.commerce.regions.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.regions")
public class RegionsProperties {

    private String regionTable = "region";
    /** Medusa v2 Region module: countries live in {@code region_country}, not {@code country}. */
    private String countryTable = "region_country";
    private String tableSchema = "public";

    public String getRegionTable() {
        return regionTable;
    }

    public void setRegionTable(String regionTable) {
        this.regionTable = regionTable;
    }

    public String getCountryTable() {
        return countryTable;
    }

    public void setCountryTable(String countryTable) {
        this.countryTable = countryTable;
    }

    public String getTableSchema() {
        return tableSchema;
    }

    public void setTableSchema(String tableSchema) {
        this.tableSchema = tableSchema;
    }
}
