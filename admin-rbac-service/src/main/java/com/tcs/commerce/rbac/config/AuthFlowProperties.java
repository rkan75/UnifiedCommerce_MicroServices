package com.tcs.commerce.rbac.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Public registration / password-reset UX (links in emails or API responses).
 */
@Component
@ConfigurationProperties(prefix = "app.auth")
public class AuthFlowProperties {

    /**
     * Base URL of this service as seen by browsers, no trailing slash.
     * Used to build invite registration links (e.g. https://admin.example.com:8088).
     */
    private String publicBaseUrl = "";

    /**
     * When true, POST /auth/forgot-password includes reset_token in JSON (dev only).
     */
    private boolean exposePasswordResetTokenInResponse = false;

    /**
     * If set, invite registration assigns this rbac_role id (otherwise no roles — admin assigns later).
     */
    private String defaultRoleIdOnInviteRegister = "";

    public String getPublicBaseUrl() { return publicBaseUrl != null ? publicBaseUrl.trim() : ""; }
    public void setPublicBaseUrl(String publicBaseUrl) { this.publicBaseUrl = publicBaseUrl; }
    public boolean isExposePasswordResetTokenInResponse() { return exposePasswordResetTokenInResponse; }
    public void setExposePasswordResetTokenInResponse(boolean exposePasswordResetTokenInResponse) {
        this.exposePasswordResetTokenInResponse = exposePasswordResetTokenInResponse;
    }
    public String getDefaultRoleIdOnInviteRegister() { return defaultRoleIdOnInviteRegister != null ? defaultRoleIdOnInviteRegister.trim() : ""; }
    public void setDefaultRoleIdOnInviteRegister(String defaultRoleIdOnInviteRegister) {
        this.defaultRoleIdOnInviteRegister = defaultRoleIdOnInviteRegister;
    }

    public String registrationPageUrl(String inviteToken) {
        String base = getPublicBaseUrl();
        if (base.isEmpty() || inviteToken == null || inviteToken.isBlank()) return "";
        return base + "/auth/register.html?token=" + java.net.URLEncoder.encode(inviteToken.strip(), java.nio.charset.StandardCharsets.UTF_8);
    }

    public String passwordResetPageUrl(String resetJwt) {
        String base = getPublicBaseUrl();
        if (base.isEmpty() || resetJwt == null || resetJwt.isBlank()) return "";
        return base + "/auth/reset-password.html?token=" + java.net.URLEncoder.encode(resetJwt.strip(), java.nio.charset.StandardCharsets.UTF_8);
    }
}
