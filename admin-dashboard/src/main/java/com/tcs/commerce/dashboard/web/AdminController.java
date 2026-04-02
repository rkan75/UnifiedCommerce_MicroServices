package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.service.ProxyService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final DashboardProperties props;
    private final ProxyService proxyService;

    public AdminController(DashboardProperties props, ProxyService proxyService) {
        this.props = props;
        this.proxyService = proxyService;
    }

    /**
     * Backoffice contract: rich user with {@code is_admin}, {@code can_create_store_user}, {@code store_id}.
     */
    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        return proxyMe(request);
    }

    /** Legacy / alternate path; same payload as {@code GET /admin/me}. */
    @GetMapping("/users/me")
    public ResponseEntity<?> usersMe(HttpServletRequest request) {
        return proxyMe(request);
    }

    private ResponseEntity<?> proxyMe(HttpServletRequest request) {
        String token = getToken(request);
        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }
        String base = props.getAdminRbacUrl() != null ? props.getAdminRbacUrl().replaceAll("/$", "") : "";
        if (base.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", "ADMIN_RBAC_SERVICE_URL not set."));
        }
        ProxyService.ProxyResult result = proxyService.proxy(base, "/admin/me", HttpMethod.GET, null, token);
        return ResponseEntity.status(result.status()).body(result.body());
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
