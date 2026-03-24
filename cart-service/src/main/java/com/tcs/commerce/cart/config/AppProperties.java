package com.tcs.commerce.cart.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    /**
     * Optional Medusa backend URL. When set, complete() may delegate order creation to Medusa.
     * When not set, complete() creates order in commerce_order table.
     */
    private String medusaBackendUrl = "";

    public String getMedusaBackendUrl() {
        return medusaBackendUrl;
    }

    public void setMedusaBackendUrl(String medusaBackendUrl) {
        this.medusaBackendUrl = medusaBackendUrl != null ? medusaBackendUrl : "";
    }
}
