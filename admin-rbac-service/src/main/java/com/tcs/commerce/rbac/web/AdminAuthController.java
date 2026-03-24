package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.security.AdminJwtHelper;
import com.tcs.commerce.rbac.service.AdminAuthService;
import com.tcs.commerce.rbac.service.LoginResult;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * Admin auth: login (POST /auth/user/emailpass) and validate (GET /auth/validate).
 * Replaces Medusa admin auth; store backend proxies here and uses same JWT secret for cookie validation.
 */
@RestController
public class AdminAuthController {

    private final AdminAuthService adminAuthService;
    private final AdminJwtHelper jwtHelper;

    public AdminAuthController(AdminAuthService adminAuthService, AdminJwtHelper jwtHelper) {
        this.adminAuthService = adminAuthService;
        this.jwtHelper = jwtHelper;
    }

    @PostMapping("/auth/user/emailpass")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        String email = body != null && body.get("email") != null ? String.valueOf(body.get("email")).trim() : null;
        String password = body != null && body.get("password") != null ? String.valueOf(body.get("password")).trim() : null;
        LoginResult result = adminAuthService.login(email, password);
        switch (result.getStatus()) {
            case OK:
                return ResponseEntity.ok(Map.of("token", result.getToken().orElseThrow()));
            case JWT_FAILED:
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Login succeeded but token could not be issued. Set ADMIN_JWT_SECRET (or JWT_SECRET) in admin-rbac-service and ensure it matches the store backend."));
            case NO_CREDENTIAL:
            case BAD_PASSWORD:
            default:
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password."));
        }
    }

    @GetMapping("/auth/validate")
    @PostMapping("/auth/validate")
    public ResponseEntity<?> validate(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Missing or invalid Authorization."));
        }
        String token = auth.substring(7).trim();
        Optional<AdminJwtHelper.AdminTokenPayload> payload = jwtHelper.validateToken(token);
        if (payload.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid or expired token."));
        }
        return ResponseEntity.ok(Map.of(
            "actor_id", payload.get().actorId(),
            "auth_identity_id", payload.get().authIdentityId(),
            "actor_type", "user"
        ));
    }

    /**
     * Register credential for an existing admin user (called by store backend after create-admin-user or invite accept).
     * Body: { "email": "...", "password": "..." }
     */
    @PostMapping("/auth/admin/register-credential")
    public ResponseEntity<?> registerCredential(@RequestBody Map<String, String> body) {
        String email = body != null ? body.get("email") : null;
        String password = body != null ? body.get("password") : null;
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "email and password required."));
        }
        boolean ok = adminAuthService.registerCredential(email, password);
        if (!ok) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("message", "User not found or could not save credential."));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
