package com.tcs.commerce.customer.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.customer")
public class CustomerProperties {

    private String jwtSecret = "";
    private long jwtExpiresSeconds = 604800L; // 7 days
    private String customerTable = "customer";
    private String addressTable = "address";
    private String authTable = "customer_auth";
    private String tableSchema = "public";
    private int resetTokenValidSeconds = 3600;

    public String getJwtSecret() {
        return jwtSecret;
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret != null ? jwtSecret : "";
    }

    public String getCustomerTable() {
        return customerTable;
    }

    public void setCustomerTable(String customerTable) {
        this.customerTable = customerTable;
    }

    public String getAddressTable() {
        return addressTable;
    }

    public void setAddressTable(String addressTable) {
        this.addressTable = addressTable;
    }

    public String getTableSchema() {
        return tableSchema;
    }

    public void setTableSchema(String tableSchema) {
        this.tableSchema = tableSchema;
    }

    public long getJwtExpiresSeconds() {
        return jwtExpiresSeconds;
    }

    public void setJwtExpiresSeconds(long jwtExpiresSeconds) {
        this.jwtExpiresSeconds = jwtExpiresSeconds;
    }

    public String getAuthTable() {
        return authTable;
    }

    public void setAuthTable(String authTable) {
        this.authTable = authTable;
    }

    public int getResetTokenValidSeconds() {
        return resetTokenValidSeconds;
    }

    public void setResetTokenValidSeconds(int resetTokenValidSeconds) {
        this.resetTokenValidSeconds = resetTokenValidSeconds;
    }
}
