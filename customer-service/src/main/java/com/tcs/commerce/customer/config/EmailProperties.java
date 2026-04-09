package com.tcs.commerce.customer.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Same structure as admin-rbac {@code app.email} — swap {@code provider} when adding new vendors.
 */
@Component
@ConfigurationProperties(prefix = "app.email")
public class EmailProperties {

    private boolean enabled = false;
    private String provider = "noop";
    private String fromAddress = "";
    private String fromName = "Store";
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
