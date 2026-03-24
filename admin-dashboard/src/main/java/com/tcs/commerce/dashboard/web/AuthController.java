package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.security.JwtValidator;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * Login (proxy to admin-rbac) and session (validate JWT from cookie). Medusa-dashboard compatible.
 */
@RestController
@RequestMapping
public class AuthController {

    private final DashboardProperties props;
    private final JwtValidator jwtValidator;
    private final WebClient webClient;

    public AuthController(DashboardProperties props, JwtValidator jwtValidator, WebClient webClient) {
        this.props = props;
        this.jwtValidator = jwtValidator;
        this.webClient = webClient;
    }

    @PostMapping(value = "/auth/user/emailpass", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        String base = props.getAdminRbacUrl().replaceAll("/$", "");
        if (base.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "ADMIN_RBAC_SERVICE_URL not set."));
        }
        try {
            Map<?, ?> result = webClient.post()
                .uri(base + "/auth/user/emailpass")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(body != null ? body : Map.of())
                .retrieve()
                .bodyToMono(Map.class)
                .block();
            if (result != null && result.get("token") != null) {
                String token = result.get("token").toString();
                Cookie cookie = new Cookie(props.getCookieName(), token);
                cookie.setPath("/");
                cookie.setMaxAge(7 * 24 * 60 * 60);
                cookie.setHttpOnly(true);
                response.addCookie(cookie);
                return ResponseEntity.ok(Map.of("token", token));
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Admin auth service unavailable"));
        }
    }

    @GetMapping("/auth/session")
    @PostMapping(value = "/auth/session", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> session(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        String token = getToken(request);
        if (body != null && (body.get("token") != null || body.get("auth_token") != null || body.get("access_token") != null)) {
            Object t = body.get("token");
            if (t == null) t = body.get("auth_token");
            if (t == null) t = body.get("access_token");
            if (t != null) token = t.toString();
        }
        var auth = token != null ? jwtValidator.validate(token) : java.util.Optional.<JwtValidator.SessionPayload>empty();
        if (auth.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valid", false, "message", "Invalid or expired token."));
        }
        var p = auth.get();
        return ResponseEntity.ok(Map.of(
            "valid", true,
            "actor_id", p.actorId(),
            "auth_identity_id", p.authIdentityId(),
            "actor_type", "user"
        ));
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
