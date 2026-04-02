package com.tcs.commerce.search.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class AdminSearchResponse {
    private String query;
    private int limit;
    private int offset;
    private List<String> requestedTypes = new ArrayList<>();
    private List<ResultByType> results = new ArrayList<>();

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public int getOffset() {
        return offset;
    }

    public void setOffset(int offset) {
        this.offset = offset;
    }

    public List<String> getRequestedTypes() {
        return requestedTypes;
    }

    public void setRequestedTypes(List<String> requestedTypes) {
        this.requestedTypes = requestedTypes != null ? requestedTypes : new ArrayList<>();
    }

    public List<ResultByType> getResults() {
        return results;
    }

    public void setResults(List<ResultByType> results) {
        this.results = results != null ? results : new ArrayList<>();
    }

    public static class ResultByType {
        private String type;
        private int count;
        private List<Map<String, Object>> items = new ArrayList<>();
        private String error;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public int getCount() {
            return count;
        }

        public void setCount(int count) {
            this.count = count;
        }

        public List<Map<String, Object>> getItems() {
            return items;
        }

        public void setItems(List<Map<String, Object>> items) {
            this.items = items != null ? items : new ArrayList<>();
        }

        public String getError() {
            return error;
        }

        public void setError(String error) {
            this.error = error;
        }
    }
}
