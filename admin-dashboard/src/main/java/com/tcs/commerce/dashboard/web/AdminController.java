package com.tcs.commerce.dashboard.web;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.security.JwtValidator;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final DashboardProperties props;
    private final JwtValidator jwtValidator;

    public AdminController(DashboardProperties props, JwtValidator jwtValidator) {
        this.props = props;
        this.jwtValidator = jwtValidator;
    }

    @GetMapping("/users/me")
    public ResponseEntity<?> usersMe(HttpServletRequest request) {
        JwtValidator.SessionPayload auth = (JwtValidator.SessionPayload) request.getAttribute("auth");
        if (auth == null) {
            String token = getToken(request);
            auth = token != null ? jwtValidator.validate(token).orElse(null) : null;
        }
        if (auth == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        return ResponseEntity.ok(Map.of("user", Map.of(
            "id", auth.actorId(),
            "email", "",
            "first_name", "",
            "last_name", "",
            "metadata", Map.of(),
            "app_metadata", Map.of()
        )));
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
