package com.tcs.commerce.rbac.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.admin-auth")
public class AdminAuthProperties {

    private String jwtSecret = "";
    private long jwtExpiresSeconds = 604800L;
    /** Short-lived JWT for password reset links (seconds). */
    private long passwordResetExpiresSeconds = 3600L;
    private String credentialTable = "admin_credential";

    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret != null ? jwtSecret : ""; }
    public long getJwtExpiresSeconds() { return jwtExpiresSeconds; }
    public void setJwtExpiresSeconds(long jwtExpiresSeconds) { this.jwtExpiresSeconds = jwtExpiresSeconds; }
    public long getPasswordResetExpiresSeconds() { return passwordResetExpiresSeconds; }
    public void setPasswordResetExpiresSeconds(long passwordResetExpiresSeconds) {
        this.passwordResetExpiresSeconds = passwordResetExpiresSeconds;
    }
    public String getCredentialTable() { return credentialTable; }
    public void setCredentialTable(String credentialTable) { this.credentialTable = credentialTable != null ? credentialTable : "admin_credential"; }

    public String qualifiedCredentialTable(String schema) {
        String s = (schema != null && !schema.isBlank()) ? schema : "public";
        return s + "." + (credentialTable != null && !credentialTable.isBlank() ? credentialTable : "admin_credential");
    }
}
