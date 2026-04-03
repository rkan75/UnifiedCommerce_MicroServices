package com.tcs.commerce.search.service;

import com.tcs.commerce.search.config.AdminSearchProperties;
import com.tcs.commerce.search.web.AdminSearchResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminSearchService {

    private final AdminSearchProperties props;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AdminSearchService(AdminSearchProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Math.max(1000, props.getTimeoutMs()));
        factory.setReadTimeout(Math.max(1000, props.getTimeoutMs()));
        this.restTemplate = new RestTemplate(factory);
    }

    public AdminSearchResponse search(String q, String types, Integer limit, Integer offset, String bearerToken) {
        int safeLimit = limit != null ? Math.max(1, Math.min(limit, props.getMaxLimit())) : props.getDefaultLimit();
        int safeOffset = offset != null ? Math.max(0, offset) : 0;
        List<String> requestedTypes = resolveTypes(types);

        AdminSearchResponse response = new AdminSearchResponse();
        response.setQuery(q != null ? q : "");
        response.setLimit(safeLimit);
        response.setOffset(safeOffset);
        response.setRequestedTypes(requestedTypes);

        List<AdminSearchResponse.ResultByType> results = new ArrayList<>();
        for (String type : requestedTypes) {
            results.add(searchSingleType(type, q, safeLimit, safeOffset, bearerToken));
        }
        response.setResults(results);
        return response;
    }

    public List<String> supportedTypes() {
        return new ArrayList<>(props.getTargets().keySet());
    }

    private AdminSearchResponse.ResultByType searchSingleType(String type, String q, int limit, int offset, String bearerToken) {
        AdminSearchResponse.ResultByType out = new AdminSearchResponse.ResultByType();
        out.setType(type);

        AdminSearchProperties.Target target = props.getTargets().get(type);
        if (target == null || target.getBaseUrl().isBlank() || target.getPath().isBlank()) {
            out.setError("Missing target configuration for type: " + type);
            return out;
        }

        String url = buildUrl(target, q, limit, offset);
        HttpHeaders headers = new HttpHeaders();
        if (bearerToken != null && !bearerToken.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken.trim());
        }
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map<String, Object>> upstream = restTemplate.exchange(
                url, HttpMethod.GET, entity, new ParameterizedTypeReference<Map<String, Object>>() {});
            Map<String, Object> body = toMap(upstream.getBody());
            List<Map<String, Object>> items = extractItems(body, target.getResponseKey());
            int count = extractCount(body, items.size());
            out.setItems(items);
            out.setCount(count);
        } catch (Exception e) {
            out.setError(e.getMessage() != null ? e.getMessage() : "Upstream request failed");
        }

        return out;
    }

    private String buildUrl(AdminSearchProperties.Target target, String q, int limit, int offset) {
        String base = target.getBaseUrl().replaceAll("/+$", "");
        String path = target.getPath().startsWith("/") ? target.getPath() : "/" + target.getPath();
        UriComponentsBuilder b = UriComponentsBuilder.fromHttpUrl(base + path);
        if (q != null && !q.isBlank()) b.queryParam(target.getQueryParam(), q.trim());
        b.queryParam("limit", limit).queryParam("offset", offset);
        return b.toUriString();
    }

    private List<String> resolveTypes(String types) {
        if (types == null || types.isBlank()) {
            return supportedTypes();
        }
        List<String> requested = Arrays.stream(types.split(","))
            .map(s -> s == null ? "" : s.trim().toLowerCase(Locale.ROOT))
            .filter(s -> !s.isBlank())
            .distinct()
            .collect(Collectors.toList());
        if (requested.isEmpty()) return supportedTypes();
        return requested;
    }

    private Map<String, Object> toMap(Object body) {
        if (body == null) return Map.of();
        if (body instanceof Map<?, ?> map) {
            return objectMapper.convertValue(map, new TypeReference<>() {});
        }
        return Map.of();
    }

    private List<Map<String, Object>> extractItems(Map<String, Object> body, String responseKey) {
        if (body == null || body.isEmpty()) return List.of();
        if (responseKey != null && !responseKey.isBlank()) {
            Object v = body.get(responseKey);
            if (v instanceof List<?> list) return toListOfMaps(list);
            if (v instanceof Map<?, ?> mapObj) {
                return List.of(objectMapper.convertValue(mapObj, new TypeReference<>() {}));
            }
        }
        for (Object value : body.values()) {
            if (value instanceof List<?> list) return toListOfMaps(list);
        }
        return List.of();
    }

    private List<Map<String, Object>> toListOfMaps(List<?> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
                out.add(objectMapper.convertValue(m, new TypeReference<>() {}));
            }
        }
        return out;
    }

    private int extractCount(Map<String, Object> body, int fallback) {
        Object count = body != null ? body.get("count") : null;
        if (count instanceof Number n) return n.intValue();
        return fallback;
    }
}
