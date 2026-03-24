package com.tcs.commerce.customer.web;

import com.tcs.commerce.customer.service.AuthService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Auth endpoints: register, login, logout, password reset. Replaces Medusa auth for customers.
 */
@RestController
@RequestMapping(value = "/auth", produces = MediaType.APPLICATION_JSON_VALUE)
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping(value = "/customer/emailpass/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        String email = body != null && body.get("email") != null ? body.get("email").toString().trim() : null;
        String password = body != null && body.get("password") != null ? body.get("password").toString() : null;
        String firstName = body != null && body.get("first_name") != null ? body.get("first_name").toString().trim() : null;
        String lastName = body != null && body.get("last_name") != null ? body.get("last_name").toString().trim() : null;
        String phone = body != null && body.get("phone") != null ? body.get("phone").toString().trim() : null;
        if (email == null || email.isEmpty() || password == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "email and password required"));
        }
        var result = authService.register(email, password, firstName, lastName, phone);
        switch (result.getStatus()) {
            case OK:
                return ResponseEntity.ok(Map.of("token", result.getToken().orElseThrow()));
            case ALREADY_EXISTS:
                return ResponseEntity.badRequest().body(Map.of("message", "Email already registered. Try logging in."));
            case JWT_ERROR:
                return ResponseEntity.status(503).body(Map.of(
                    "message",
                    "Registration could not complete: JWT_SECRET is not set on the customer-service. Set JWT_SECRET in the environment (e.g. export JWT_SECRET=your_secret_at_least_32_chars) and restart the service. See customer-service/README.md."
                ));
            case PARTIAL:
                return ResponseEntity.status(409).body(Map.of(
                    "message",
                    "Your account may have been created but sign-in could not be completed. Please try logging in. If login fails, ensure the customer_auth table exists (run customer-service schema-auth.sql)."
                ));
            default:
                return ResponseEntity.badRequest().body(Map.of("message", "Registration failed."));
        }
    }

    @PostMapping(value = "/customer/emailpass", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        String email = body != null && body.get("email") != null ? body.get("email").toString().trim() : null;
        String password = body != null && body.get("password") != null ? body.get("password").toString() : null;
        if (email == null || email.isEmpty() || password == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid email or password"));
        }
        var result = authService.login(email, password);
        switch (result.getStatus()) {
            case OK:
                return ResponseEntity.ok(Map.of("token", result.getToken().orElseThrow()));
            case JWT_ERROR:
                return ResponseEntity.status(503).body(Map.of(
                    "message",
                    "Login could not complete: JWT_SECRET is not set on the customer-service. Set JWT_SECRET in the environment and restart. See customer-service/README.md."
                ));
            case NOT_FOUND:
            case BAD_PASSWORD:
            default:
                return ResponseEntity.status(401).body(Map.of("message", "Invalid email or password"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout() {
        return ResponseEntity.ok(Map.of("message", "OK"));
    }

    @PostMapping(value = "/customer/emailpass/reset-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> requestPasswordReset(@RequestBody Map<String, Object> body) {
        String identifier = body != null && body.get("identifier") != null ? body.get("identifier").toString().trim() : null;
        if (identifier == null || identifier.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "identifier (email) required"));
        }
        authService.requestPasswordReset(identifier);
        return ResponseEntity.ok(Map.of("message", "success"));
    }

    @PostMapping(value = "/customer/emailpass/update-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> resetPasswordWithToken(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestBody Map<String, Object> body
    ) {
        String token = null;
        if (authorization != null && authorization.startsWith("Bearer ")) {
            token = authorization.substring(7).trim();
        }
        if (token == null && body != null && body.get("token") != null) {
            token = body.get("token").toString().trim();
        }
        String password = body != null && body.get("password") != null ? body.get("password").toString() : null;
        if (token == null || token.isEmpty() || password == null || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "token and password required"));
        }
        boolean ok = authService.resetPasswordWithToken(token, password);
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid or expired reset link. Please request a new one."));
        }
        return ResponseEntity.ok(Map.of("message", "success"));
    }
}
