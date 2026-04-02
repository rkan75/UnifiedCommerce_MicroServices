package com.tcs.commerce.dashboard.service;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Map;

/**
 * Forwards requests to backend microservices with optional Bearer token.
 */
@Service
public class ProxyService {

    private final WebClient webClient;

    public ProxyService(WebClient webClient) {
        this.webClient = webClient;
    }

    public ProxyResult proxy(String baseUrl, String pathAndQuery, HttpMethod method, Object body, String bearerToken) {
        String base = (baseUrl != null ? baseUrl : "").replaceAll("/$", "");
        if (base.isEmpty()) return new ProxyResult(503, Map.of("message", "Service URL not configured"));
        String url = base + (pathAndQuery != null ? pathAndQuery : "");
        try {
            org.springframework.web.reactive.function.client.WebClient.RequestHeadersSpec<?> spec;
            boolean withBody = body != null && method != HttpMethod.GET && method != HttpMethod.HEAD;
            if (withBody) {
                spec = webClient.method(method).uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(body);
            } else {
                spec = webClient.method(method).uri(url).accept(MediaType.APPLICATION_JSON);
            }
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken);
            }
            var response = spec.retrieve().toEntity(Map.class).block();
            if (response != null && response.getBody() != null) {
                return new ProxyResult(response.getStatusCode().value(), response.getBody());
            }
            return new ProxyResult(500, Map.of("message", "Empty response"));
        } catch (WebClientResponseException e) {
            String raw = e.getResponseBodyAsString();
            if (raw != null && !raw.isBlank()) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> parsed = new com.fasterxml.jackson.databind.ObjectMapper().readValue(raw, Map.class);
                    return new ProxyResult(e.getStatusCode().value(), parsed);
                } catch (Exception ignored) {}
            }
            return new ProxyResult(e.getStatusCode().value(), Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return new ProxyResult(502, Map.of("message", e.getMessage() != null ? e.getMessage() : "Service unavailable"));
        }
    }

    /**
     * Proxies GET/HEAD (or JSON responses) as a raw JSON string without parsing into {@link Map}.
     * Large payloads (e.g. product lists with base64 thumbnails) can be mishandled when round-tripped through {@link Map}.
     */
    public JsonBodyProxyResult proxyJsonBody(String baseUrl, String pathAndQuery, HttpMethod method, Object body, String bearerToken) {
        com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
        String base = (baseUrl != null ? baseUrl : "").replaceAll("/$", "");
        if (base.isEmpty()) {
            try {
                return new JsonBodyProxyResult(503, om.writeValueAsString(Map.of("message", "Service URL not configured")));
            } catch (Exception ex) {
                return new JsonBodyProxyResult(503, "{\"message\":\"Service URL not configured\"}");
            }
        }
        String url = base + (pathAndQuery != null ? pathAndQuery : "");
        try {
            org.springframework.web.reactive.function.client.WebClient.RequestHeadersSpec<?> spec;
            boolean withBody = body != null && method != HttpMethod.GET && method != HttpMethod.HEAD;
            if (withBody) {
                spec = webClient.method(method).uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(body);
            } else {
                spec = webClient.method(method).uri(url).accept(MediaType.APPLICATION_JSON);
            }
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken);
            }
            ResponseEntity<String> response = spec.retrieve().toEntity(String.class).block();
            if (response != null && response.getBody() != null && !response.getBody().isBlank()) {
                return new JsonBodyProxyResult(response.getStatusCode().value(), response.getBody());
            }
            try {
                return new JsonBodyProxyResult(500, om.writeValueAsString(Map.of("message", "Empty response")));
            } catch (Exception ex) {
                return new JsonBodyProxyResult(500, "{\"message\":\"Empty response\"}");
            }
        } catch (WebClientResponseException e) {
            String raw = e.getResponseBodyAsString();
            if (raw != null && !raw.isBlank()) {
                return new JsonBodyProxyResult(e.getStatusCode().value(), raw);
            }
            try {
                return new JsonBodyProxyResult(
                    e.getStatusCode().value(),
                    om.writeValueAsString(Map.of("message", e.getMessage() != null ? e.getMessage() : "error"))
                );
            } catch (Exception ex) {
                return new JsonBodyProxyResult(e.getStatusCode().value(), "{\"message\":\"error\"}");
            }
        } catch (Exception e) {
            try {
                return new JsonBodyProxyResult(
                    502,
                    om.writeValueAsString(Map.of("message", e.getMessage() != null ? e.getMessage() : "Service unavailable"))
                );
            } catch (Exception ex) {
                return new JsonBodyProxyResult(502, "{\"message\":\"Service unavailable\"}");
            }
        }
    }

    /**
     * Proxies a binary response (e.g. CSV export). Forwards Content-Type and Content-Disposition when present.
     */
    public BinaryProxyResult proxyBinary(String baseUrl, String pathAndQuery, HttpMethod method, String bearerToken) {
        String base = (baseUrl != null ? baseUrl : "").replaceAll("/$", "");
        if (base.isEmpty()) {
            return new BinaryProxyResult(503, new HttpHeaders(), new byte[0]);
        }
        String url = base + (pathAndQuery != null ? pathAndQuery : "");
        try {
            var spec = webClient.method(method).uri(url).accept(MediaType.ALL);
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken);
            }
            ResponseEntity<byte[]> entity = spec.retrieve().toEntity(byte[].class).block();
            if (entity == null) {
                return new BinaryProxyResult(500, new HttpHeaders(), new byte[0]);
            }
            HttpHeaders out = new HttpHeaders();
            if (entity.getHeaders().getContentType() != null) {
                out.setContentType(entity.getHeaders().getContentType());
            }
            if (entity.getHeaders().getContentDisposition() != null) {
                out.setContentDisposition(entity.getHeaders().getContentDisposition());
            }
            byte[] body = entity.getBody() != null ? entity.getBody() : new byte[0];
            return new BinaryProxyResult(entity.getStatusCode().value(), out, body);
        } catch (WebClientResponseException e) {
            byte[] raw = e.getResponseBodyAsByteArray();
            return new BinaryProxyResult(e.getStatusCode().value(), new HttpHeaders(), raw != null ? raw : new byte[0]);
        } catch (Exception e) {
            return new BinaryProxyResult(502, new HttpHeaders(), new byte[0]);
        }
    }

    public record ProxyResult(int status, Map<String, Object> body) {}

    public record JsonBodyProxyResult(int status, String body) {}

    public record BinaryProxyResult(int status, HttpHeaders headers, byte[] body) {}
}
