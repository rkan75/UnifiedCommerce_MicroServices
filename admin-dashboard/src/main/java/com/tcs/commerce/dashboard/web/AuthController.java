package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.security.JwtValidator;
import com.tcs.commerce.dashboard.service.ProxyService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.function.Tuple2;
import reactor.util.function.Tuples;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Login (proxy to admin-rbac) and session (validate JWT from cookie). Medusa-dashboard compatible.
 * Public invite / password-reset flows are proxied so browsers only talk to the dashboard origin.
 */
@RestController
@RequestMapping
public class AuthController {

    private final DashboardProperties props;
    private final JwtValidator jwtValidator;
    private final WebClient webClient;
    private final ProxyService proxyService;

    public AuthController(
            DashboardProperties props,
            JwtValidator jwtValidator,
            WebClient webClient,
            ProxyService proxyService) {
        this.props = props;
        this.jwtValidator = jwtValidator;
        this.webClient = webClient;
        this.proxyService = proxyService;
    }

    @PostMapping(value = "/auth/user/emailpass", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body, HttpServletResponse response) {
        String base = props.getAdminRbacUrl().replaceAll("/$", "");
        if (base.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "ADMIN_RBAC_SERVICE_URL not set."));
        }
        try {
            @SuppressWarnings("unchecked")
            Tuple2<org.springframework.http.HttpStatusCode, Map<?, ?>> tuple = webClient.post()
                .uri(base + "/auth/user/emailpass")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(body != null ? body : Map.of())
                .exchangeToMono(res -> res.bodyToMono(Map.class)
                    .defaultIfEmpty(Map.of())
                    .map(m -> Tuples.of(res.statusCode(), m != null ? (Map<?, ?>) m : Map.of())))
                .block();
            if (tuple == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", "Empty response from admin auth service."));
            }
            org.springframework.http.HttpStatusCode status = tuple.getT1();
            Map<?, ?> result = tuple.getT2();
            if (status.is2xxSuccessful() && result.get("token") != null) {
                String token = result.get("token").toString();
                Cookie cookie = new Cookie(props.getCookieName(), token);
                cookie.setPath("/");
                cookie.setMaxAge(7 * 24 * 60 * 60);
                cookie.setHttpOnly(true);
                response.addCookie(cookie);
                return ResponseEntity.ok(Map.of("token", token));
            }
            return ResponseEntity.status(status.value()).body(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Admin auth service unavailable"));
        }
    }

    @GetMapping("/auth/session")
    public ResponseEntity<?> sessionGet(HttpServletRequest request) {
        return sessionResponse(request, null);
    }

    @PostMapping(value = "/auth/session", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> sessionPost(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return sessionResponse(request, body);
    }

    private ResponseEntity<?> sessionResponse(HttpServletRequest request, Map<String, Object> body) {
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

    @GetMapping("/auth/invite/info")
    public ResponseEntity<?> inviteInfo(@RequestParam("token") String token) {
        String base = rbacBase();
        if (base.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", "ADMIN_RBAC_SERVICE_URL not set."));
        }
        String q = "?token=" + URLEncoder.encode(token != null ? token : "", StandardCharsets.UTF_8);
        ProxyService.ProxyResult result = proxyService.proxy(base, "/auth/invite/info" + q, HttpMethod.GET, null, null);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    @PostMapping(value = "/auth/invite/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> inviteRegister(@RequestBody(required = false) Map<String, Object> body) {
        return proxyJsonToRbac(HttpMethod.POST, "/auth/invite/register", body, null);
    }

    @PostMapping(value = "/auth/forgot-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> forgotPassword(@RequestBody(required = false) Map<String, String> body) {
        return proxyJsonToRbac(HttpMethod.POST, "/auth/forgot-password", body, null);
    }

    @PostMapping(value = "/auth/reset-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> resetPassword(@RequestBody(required = false) Map<String, String> body) {
        return proxyJsonToRbac(HttpMethod.POST, "/auth/reset-password", body, null);
    }

    @PostMapping(value = "/auth/change-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> changePassword(HttpServletRequest request, @RequestBody(required = false) Map<String, String> body) {
        String token = getToken(request);
        return proxyJsonToRbac(HttpMethod.POST, "/auth/change-password", body, token);
    }

    private String rbacBase() {
        return props.getAdminRbacUrl() != null ? props.getAdminRbacUrl().replaceAll("/$", "") : "";
    }

    private ResponseEntity<?> proxyJsonToRbac(HttpMethod method, String path, Object body, String bearer) {
        String base = rbacBase();
        if (base.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", "ADMIN_RBAC_SERVICE_URL not set."));
        }
        Object payload = method == HttpMethod.GET ? null : (body != null ? body : Map.of());
        ProxyService.ProxyResult result = proxyService.proxy(base, path, method, payload, bearer);
        return ResponseEntity.status(result.status()).body(result.body());
    }
}
