package com.tcs.commerce.dashboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class DashboardProperties {

    private String adminRbacUrl = "http://localhost:8088";
    private String productsUrl = "http://localhost:8082";
    private String regionsUrl = "http://localhost:8084";
    private String categoriesUrl = "http://localhost:8083";
    private String collectionsUrl = "http://localhost:8085";
    private String jwtSecret = "";
    private String cookieName = "medusa_admin_token";

    public String getAdminRbacUrl() { return adminRbacUrl; }
    public void setAdminRbacUrl(String adminRbacUrl) { this.adminRbacUrl = adminRbacUrl; }

    public String getProductsUrl() { return productsUrl; }
    public void setProductsUrl(String productsUrl) { this.productsUrl = productsUrl; }

    public String getRegionsUrl() { return regionsUrl; }
    public void setRegionsUrl(String regionsUrl) { this.regionsUrl = regionsUrl; }

    public String getCategoriesUrl() { return categoriesUrl; }
    public void setCategoriesUrl(String categoriesUrl) { this.categoriesUrl = categoriesUrl; }

    public String getCollectionsUrl() { return collectionsUrl; }
    public void setCollectionsUrl(String collectionsUrl) { this.collectionsUrl = collectionsUrl; }

    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret != null ? jwtSecret : ""; }

    public String getCookieName() { return cookieName; }
    public void setCookieName(String cookieName) { this.cookieName = cookieName != null ? cookieName : "medusa_admin_token"; }
}
