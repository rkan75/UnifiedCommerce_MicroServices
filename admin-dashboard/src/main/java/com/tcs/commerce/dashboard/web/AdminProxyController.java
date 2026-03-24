package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.service.ProxyService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Proxies /admin/* (except /admin/users/me) to the appropriate microservice.
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
        if (path.endsWith("/me") || path.contains("/users/me")) return ResponseEntity.notFound().build(); // AdminController handles /admin/users/me
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

    @RequestMapping(value = "/regions", method = { RequestMethod.GET })
    public ResponseEntity<?> regionsList(HttpServletRequest request) {
        return proxy(props.getRegionsUrl(), "/store/regions" + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/regions/{id}", method = { RequestMethod.GET })
    public ResponseEntity<?> regionById(@PathVariable String id) {
        return proxy(props.getRegionsUrl(), "/store/regions/" + id, HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/products", method = { RequestMethod.GET })
    public ResponseEntity<?> productsList(HttpServletRequest request) {
        return proxy(props.getProductsUrl(), "/store/products" + query(request), HttpMethod.GET, null, null);
    }

    @RequestMapping(value = "/products/{id}", method = RequestMethod.GET)
    public ResponseEntity<?> productById(HttpServletRequest request, @PathVariable String id) {
        String q = query(request);
        String suffix = (q == null || q.isEmpty()) ? "" : (q.startsWith("?") ? "&" + q.substring(1) : "&" + q);
        return proxy(props.getProductsUrl(), "/store/products?id=" + id + suffix, HttpMethod.GET, null, null);
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

    private ResponseEntity<?> proxy(String baseUrl, String pathAndQuery, String method, Map<String, Object> body, String token) {
        HttpMethod m = "POST".equalsIgnoreCase(method) ? HttpMethod.POST : "PATCH".equalsIgnoreCase(method) ? HttpMethod.PATCH : "DELETE".equalsIgnoreCase(method) ? HttpMethod.DELETE : HttpMethod.GET;
        var result = proxyService.proxy(baseUrl, pathAndQuery, m, body, token);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    private String query(HttpServletRequest request) {
        String q = request.getQueryString();
        return (q != null && !q.isBlank()) ? (q.startsWith("?") ? q : "?" + q) : "";
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
