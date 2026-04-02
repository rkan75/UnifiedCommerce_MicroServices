package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.service.ProxyService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

/**
 * Forwards storefront catalog GETs to products-service. When {@code PRODUCTS_SERVICE_URL} on the
 * Next.js app points at this dashboard (same host/port), {@code GET /store/products} would otherwise
 * fall through to static resources and fail with {@code No static resource store/products}.
 */
@RestController
public class StorefrontProductsProxyController {

    private final DashboardProperties props;
    private final ProxyService proxyService;

    public StorefrontProductsProxyController(DashboardProperties props, ProxyService proxyService) {
        this.props = props;
        this.proxyService = proxyService;
    }

    private static String query(HttpServletRequest request) {
        String q = request.getQueryString();
        return (q != null && !q.isBlank()) ? ("?" + q) : "";
    }

    private ResponseEntity<String> proxyJson(String pathAndQuery) {
        var result = proxyService.proxyJsonBody(props.getProductsUrl(), pathAndQuery, HttpMethod.GET, null, null);
        return ResponseEntity.status(result.status())
            .contentType(MediaType.APPLICATION_JSON)
            .body(result.body());
    }

    @GetMapping("/store/products")
    public ResponseEntity<String> storeProducts(HttpServletRequest request) {
        return proxyJson("/store/products" + query(request));
    }

    @GetMapping("/store/catalog-scope/category-ids")
    public ResponseEntity<String> catalogScopeCategoryIds(HttpServletRequest request) {
        return proxyJson("/store/catalog-scope/category-ids" + query(request));
    }

    @GetMapping("/store/catalog-scope/collection-ids")
    public ResponseEntity<String> catalogScopeCollectionIds(HttpServletRequest request) {
        return proxyJson("/store/catalog-scope/collection-ids" + query(request));
    }

    @GetMapping("/store/product-variants/{variantId}")
    public ResponseEntity<String> storeProductVariantById(
        @PathVariable String variantId,
        HttpServletRequest request
    ) {
        String enc = UriUtils.encodePathSegment(variantId, StandardCharsets.UTF_8);
        return proxyJson("/store/product-variants/" + enc + query(request));
    }

    @GetMapping("/store/product-variants")
    public ResponseEntity<String> storeProductVariants(HttpServletRequest request) {
        return proxyJson("/store/product-variants" + query(request));
    }
}
