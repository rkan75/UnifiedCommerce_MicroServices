package com.tcs.commerce.rbac.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Transactional email for admin invites and password reset. Swap {@code provider} to change vendors
 * (requires a matching {@link com.tcs.commerce.email.EmailSenderFactory} branch — add SES, SMTP, etc.).
 */
@Component
@ConfigurationProperties(prefix = "app.email")
public class EmailProperties {

    private boolean enabled = false;
    /** noop | sendgrid */
    private String provider = "noop";
    private String fromAddress = "";
    private String fromName = "Admin";
    private final SendGrid sendgrid = new SendGrid();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getFromAddress() {
        return fromAddress;
    }

    public void setFromAddress(String fromAddress) {
        this.fromAddress = fromAddress;
    }

    public String getFromName() {
        return fromName;
    }

    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    public SendGrid getSendgrid() {
        return sendgrid;
    }

    public static class SendGrid {
        private String apiKey = "";

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }
    }
}
