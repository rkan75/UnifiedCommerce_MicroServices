package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.service.ProxyService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ContentDisposition;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Proxies /admin/* (except /admin/me and /admin/users/me — see {@link AdminController}) to microservices.
 */
@RestController
@RequestMapping("/admin")
public class AdminProxyController {

    private final DashboardProperties props;
    private final ProxyService proxyService;

    public AdminProxyController(DashboardProperties props, ProxyService proxyService) {
        this.props = props;
        this.proxyService = proxyService;
    }

    @RequestMapping(value = { "/invites", "/invites/**" }, method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE })
    public ResponseEntity<?> invites(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return proxy(props.getAdminRbacUrl(), "/admin" + request.getRequestURI().substring("/admin".length()) + query(request), HttpMethod.valueOf(request.getMethod()), body, getToken(request));
    }

    @RequestMapping(value = { "/users", "/users/**" }, method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PATCH, RequestMethod.DELETE })
    public ResponseEntity<?> users(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.endsWith("/me") || path.contains("/users/me")) return ResponseEntity.notFound().build(); // AdminController handles me
        return proxy(props.getAdminRbacUrl(), "/admin" + request.getRequestURI().substring("/admin".length()) + query(request), HttpMethod.valueOf(request.getMethod()), body, getToken(request));
    }

    @RequestMapping(value = { "/roles", "/roles/**" }, method = RequestMethod.GET)
    public ResponseEntity<?> roles(HttpServletRequest request) {
        return proxy(props.getAdminRbacUrl(), "/admin" + request.getRequestURI().substring("/admin".length()) + query(request), HttpMethod.GET, null, getToken(request));
    }

    @RequestMapping(value = { "/policies", "/policies/**" }, method = RequestMethod.GET)
    public ResponseEntity<?> policies(HttpServletRequest request) {
        return proxy(props.getAdminRbacUrl(), "/admin" + request.getRequestURI().substring("/admin".length()) + query(request), HttpMethod.GET, null, getToken(request));
    }

    @RequestMapping(value = "/regions", method = { RequestMethod.GET, RequestMethod.POST })
    public ResponseEntity<?> regions(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return proxy(props.getProductsUrl(), "/admin/regions" + query(request), HttpMethod.valueOf(request.getMethod()), body, getToken(request));
    }

    /** Paginated ISO country catalog ({@code country} table) for the region editor — must be before {@code /regions/{id}}. */
    @RequestMapping(value = "/regions/meta/countries", method = RequestMethod.GET)
    public ResponseEntity<?> regionCountryCatalog(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/admin/regions/meta/countries" + query(request), HttpMethod.GET, null, getToken(request));
    }

    @RequestMapping(value = "/regions/{id}", method = { RequestMethod.GET, RequestMethod.PATCH, RequestMethod.DELETE })
    public ResponseEntity<?> regionById(
        HttpServletRequest request,
        @PathVariable String id,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        String enc = UriUtils.encodePathSegment(id, StandardCharsets.UTF_8);
        return proxy(props.getProductsUrl(), "/admin/regions/" + enc + query(request), HttpMethod.valueOf(request.getMethod()), body, getToken(request));
    }

    @RequestMapping(value = "/notifications", method = RequestMethod.GET)
    public ResponseEntity<?> adminNotifications(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/admin/notifications" + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/products/export", method = RequestMethod.POST)
    public ResponseEntity<?> productExportStart(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return proxy(props.getProductsUrl(), "/admin/products/export" + query(request), HttpMethod.POST, body, getToken(request));
    }

    @RequestMapping(value = "/products/export/{jobId}/file", method = RequestMethod.GET)
    public ResponseEntity<byte[]> productExportFile(@PathVariable String jobId, HttpServletRequest request) {
        var bin = proxyService.proxyBinary(
            props.getProductsUrl(),
            "/admin/products/export/" + jobId + "/file" + query(request),
            HttpMethod.GET,
            getToken(request)
        );
        if (bin.status() != 200) {
            return ResponseEntity.status(bin.status()).contentType(MediaType.APPLICATION_OCTET_STREAM).body(bin.body());
        }
        HttpHeaders out = new HttpHeaders();
        if (bin.headers().getContentType() != null) {
            out.setContentType(bin.headers().getContentType());
        }
        if (bin.headers().getContentDisposition() != null) {
            out.setContentDisposition(bin.headers().getContentDisposition());
        } else {
            out.setContentDisposition(ContentDisposition.attachment().filename("products-export.csv").build());
        }
        return ResponseEntity.ok().headers(out).body(bin.body());
    }

    @RequestMapping(value = "/products/export/{jobId}", method = RequestMethod.GET)
    public ResponseEntity<?> productExportStatus(@PathVariable String jobId, HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/admin/products/export/" + jobId + query(request), HttpMethod.GET, null, getToken(request));
    }

    @RequestMapping(value = "/products", method = { RequestMethod.GET })
    public ResponseEntity<String> productsList(HttpServletRequest request) {
        // Admin list must see the full catalog; append when missing so old cached UI still works.
        // Raw JSON passthrough: Map round-trip breaks very large product payloads (e.g. base64 thumbnails).
        return proxyJsonBody(props.getProductsUrl(), "/store/products" + adminProductsListQuery(request), HttpMethod.GET, null, null);
    }

    /** Persists a new product to the Medusa DB via products-service (Medusa Admin–style JSON body). */
    @PostMapping(value = "/products/batch", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> adminCreateProductsBatch(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return proxy(props.getProductsUrl(), "/admin/products/batch" + query(request), HttpMethod.POST, body, getToken(request));
    }

    @PostMapping(value = "/products", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> adminCreateProduct(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return proxy(props.getProductsUrl(), "/admin/products" + query(request), HttpMethod.POST, body, getToken(request));
    }

    @PatchMapping(value = "/products/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> adminPatchProduct(HttpServletRequest request, @PathVariable String id, @RequestBody Map<String, Object> body) {
        if ("export".equalsIgnoreCase(id) || "batch".equalsIgnoreCase(id)) {
            return ResponseEntity.notFound().build();
        }
        return proxy(props.getProductsUrl(), "/admin/products/" + id + query(request), HttpMethod.PATCH, body, getToken(request));
    }

    @PostMapping(value = "/products/{id}/variants", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> adminCreateVariant(HttpServletRequest request, @PathVariable String id, @RequestBody Map<String, Object> body) {
        if ("export".equalsIgnoreCase(id) || "batch".equalsIgnoreCase(id)) {
            return ResponseEntity.notFound().build();
        }
        return proxy(props.getProductsUrl(), "/admin/products/" + id + "/variants" + query(request), HttpMethod.POST, body, getToken(request));
    }

    @RequestMapping(value = "/inventory-items", method = RequestMethod.GET)
    public ResponseEntity<?> adminInventoryItems(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/admin/inventory-items" + query(request), HttpMethod.GET, null, getToken(request));
    }

    @RequestMapping(value = "/product-types", method = RequestMethod.GET)
    public ResponseEntity<?> productTypes(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/store/product-types" + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/product-tags", method = RequestMethod.GET)
    public ResponseEntity<?> productTags(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/store/product-tags" + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/sales-channels", method = RequestMethod.GET)
    public ResponseEntity<?> salesChannels(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/store/sales-channels" + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/products/{id}/inventory-kit-candidates", method = RequestMethod.GET)
    public ResponseEntity<?> adminInventoryKitCandidates(HttpServletRequest request, @PathVariable String id) {
        if ("export".equalsIgnoreCase(id) || "batch".equalsIgnoreCase(id)) {
            return ResponseEntity.notFound().build();
        }
        return proxy(
            props.getProductsUrl(),
            "/admin/products/" + id + "/inventory-kit-candidates" + query(request),
            HttpMethod.GET,
            null,
            getToken(request)
        );
    }

    @RequestMapping(value = "/products/{id}", method = RequestMethod.GET)
    public ResponseEntity<String> productById(HttpServletRequest request, @PathVariable String id) {
        // Avoid shadowing sub-routes like /products/export, /products/batch (same path pattern).
        if ("export".equalsIgnoreCase(id) || "batch".equalsIgnoreCase(id)) {
            return ResponseEntity.notFound().build();
        }
        return proxyJsonBody(
            props.getProductsUrl(),
            "/store/products" + adminProductByIdQuery(request, id),
            HttpMethod.GET,
            null,
            null
        );
    }

    @RequestMapping(value = { "/product-variants", "/product-variants/**" }, method = RequestMethod.GET)
    public ResponseEntity<?> productVariants(HttpServletRequest request) {
        String path = request.getRequestURI().substring("/admin".length());
        String backendPath = "/store" + path.replace("/product-variants", "/product-variants");
        return proxy(props.getProductsUrl(), backendPath + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = { "/product-categories", "/product-categories/**" }, method = RequestMethod.GET)
    public ResponseEntity<?> productCategories(HttpServletRequest request) {
        String path = request.getRequestURI().substring("/admin".length());
        return proxy(props.getCategoriesUrl(), "/store" + path + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = { "/product-collections", "/product-collections/**" }, method = RequestMethod.GET)
    public ResponseEntity<?> productCollections(HttpServletRequest request) {
        String path = request.getRequestURI().substring("/admin".length());
        String backendPath = path.replace("/product-collections", "/collections");
        return proxy(props.getCollectionsUrl(), "/store" + backendPath + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/search", method = RequestMethod.GET)
    public ResponseEntity<?> adminSearch(HttpServletRequest request) {
        return proxy(props.getSearchUrl(), "/admin/search" + query(request), HttpMethod.GET, null, getToken(request));
    }

    @RequestMapping(value = "/search/meta", method = RequestMethod.GET)
    public ResponseEntity<?> adminSearchMeta(HttpServletRequest request) {
        return proxy(props.getSearchUrl(), "/admin/search/meta" + query(request), HttpMethod.GET, null, getToken(request));
    }

    @GetMapping("/store")
    public ResponseEntity<?> adminStoreGet(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/admin/store" + query(request), HttpMethod.GET, null, getToken(request));
    }

    @PatchMapping(value = "/store", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> adminStorePatch(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return proxy(props.getProductsUrl(), "/admin/store" + query(request), HttpMethod.PATCH, body, getToken(request));
    }

    @PatchMapping(value = "/currencies/{code}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> adminCurrencyPatch(
        HttpServletRequest request,
        @PathVariable String code,
        @RequestBody Map<String, Object> body
    ) {
        String enc = UriUtils.encodePathSegment(code, StandardCharsets.UTF_8);
        return proxy(props.getProductsUrl(), "/admin/currencies/" + enc + query(request), HttpMethod.PATCH, body, getToken(request));
    }

    @DeleteMapping("/currencies/{code}")
    public ResponseEntity<?> adminCurrencyDelete(HttpServletRequest request, @PathVariable String code) {
        String enc = UriUtils.encodePathSegment(code, StandardCharsets.UTF_8);
        return proxy(props.getProductsUrl(), "/admin/currencies/" + enc + query(request), HttpMethod.DELETE, null, getToken(request));
    }

    private ResponseEntity<?> proxy(String baseUrl, String pathAndQuery, HttpMethod method, Map<String, Object> body, String token) {
        var result = proxyService.proxy(baseUrl, pathAndQuery, method, body, token);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    private ResponseEntity<String> proxyJsonBody(String baseUrl, String pathAndQuery, HttpMethod method, Object body, String token) {
        var result = proxyService.proxyJsonBody(baseUrl, pathAndQuery, method, body, token);
        return ResponseEntity.status(result.status())
            .contentType(MediaType.APPLICATION_JSON)
            .body(result.body());
    }

    private String query(HttpServletRequest request) {
        String q = request.getQueryString();
        return (q != null && !q.isBlank()) ? (q.startsWith("?") ? q : "?" + q) : "";
    }

    /**
     * GET /admin/products proxies to products-service {@code /store/products}. Always add {@code admin_catalog=1}
     * unless already present so {@code CATALOG_DEFAULT_PRODUCT_TYPE_ID} does not hide products on the admin table.
     */
    private String adminProductsListQuery(HttpServletRequest request) {
        String q = request.getQueryString();
        if (q == null || q.isBlank()) {
            return "?admin_catalog=1";
        }
        String raw = q.startsWith("?") ? q.substring(1) : q;
        if (raw.contains("admin_catalog=")) {
            return "?" + raw;
        }
        return "?" + raw + "&admin_catalog=1";
    }

    /**
     * GET /admin/products/{id} → {@code /store/products?id=…}; ensures {@code admin_catalog=1} and correct URL-encoding.
     */
    private String adminProductByIdQuery(HttpServletRequest request, String productId) {
        String encId = UriUtils.encodeQueryParam(productId, StandardCharsets.UTF_8);
        StringBuilder sb = new StringBuilder("?id=").append(encId);
        String q = request.getQueryString();
        if (q != null && !q.isBlank()) {
            String raw = q.startsWith("?") ? q.substring(1) : q;
            for (String pair : raw.split("&")) {
                if (pair.isEmpty()) {
                    continue;
                }
                int eq = pair.indexOf('=');
                String key = eq >= 0 ? pair.substring(0, eq) : pair;
                if ("id".equalsIgnoreCase(key)) {
                    continue;
                }
                sb.append('&').append(pair);
            }
        }
        String built = sb.toString();
        if (!built.contains("admin_catalog=")) {
            sb.append("&admin_catalog=1");
        }
        return sb.toString();
    }

    private String getToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (props.getCookieName().equals(c.getName())) return c.getValue();
            }
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) return auth.substring(7).trim();
        return null;
    }
}
