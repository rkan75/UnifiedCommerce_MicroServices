package com.tcs.commerce.search.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "app.admin-search")
public class AdminSearchProperties {

    private int defaultLimit = 10;
    private int maxLimit = 50;
    private int timeoutMs = 4000;
    private Map<String, Target> targets = new LinkedHashMap<>();

    public int getDefaultLimit() {
        return defaultLimit;
    }

    public void setDefaultLimit(int defaultLimit) {
        this.defaultLimit = defaultLimit;
    }

    public int getMaxLimit() {
        return maxLimit;
    }

    public void setMaxLimit(int maxLimit) {
        this.maxLimit = maxLimit;
    }

    public int getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public Map<String, Target> getTargets() {
        return targets;
    }

    public void setTargets(Map<String, Target> targets) {
        this.targets = targets != null ? targets : new LinkedHashMap<>();
    }

    public static class Target {
        private String baseUrl = "";
        private String path = "";
        private String responseKey = "";
        private String queryParam = "q";

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl != null ? baseUrl.trim() : "";
        }

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path != null ? path.trim() : "";
        }

        public String getResponseKey() {
            return responseKey;
        }

        public void setResponseKey(String responseKey) {
            this.responseKey = responseKey != null ? responseKey.trim() : "";
        }

        public String getQueryParam() {
            return queryParam;
        }

        public void setQueryParam(String queryParam) {
            this.queryParam = queryParam != null && !queryParam.isBlank() ? queryParam.trim() : "q";
        }
    }
}
