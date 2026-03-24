package com.tcs.commerce.dashboard.service;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Map;

/**
 * Forwards requests to backend microservices with optional Bearer token.
 */
@Service
public class ProxyService {

    private final WebClient webClient = WebClient.builder().build();

    public ProxyResult proxy(String baseUrl, String pathAndQuery, HttpMethod method, Object body, String bearerToken) {
        String base = (baseUrl != null ? baseUrl : "").replaceAll("/$", "");
        if (base.isEmpty()) return new ProxyResult(503, Map.of("message", "Service URL not configured"));
        String url = base + (pathAndQuery != null ? pathAndQuery : "");
        try {
            var spec = webClient.method(method).uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON);
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec = spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken);
            }
            if (body != null && method != HttpMethod.GET) {
                spec = spec.bodyValue(body);
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

    public record ProxyResult(int status, Map<String, Object> body) {}
}
