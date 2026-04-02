package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.security.AdminJwtHelper;
import com.tcs.commerce.rbac.service.BackofficeMeService;
import com.tcs.commerce.rbac.service.RbacService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

/**
 * Backoffice-compatible current user: {@code GET /admin/me} with {@code is_admin}, {@code can_create_store_user}, {@code store_id}.
 */
@RestController
public class AdminMeController {

    private final AdminJwtHelper jwtHelper;
    private final RbacService rbacService;
    private final BackofficeMeService backofficeMeService;

    public AdminMeController(AdminJwtHelper jwtHelper, RbacService rbacService, BackofficeMeService backofficeMeService) {
        this.jwtHelper = jwtHelper;
        this.rbacService = rbacService;
        this.backofficeMeService = backofficeMeService;
    }

    @GetMapping("/admin/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Missing or invalid Authorization."));
        }
        String token = auth.substring(7).trim();
        Optional<AdminJwtHelper.AdminTokenPayload> payload = jwtHelper.validateToken(token);
        if (payload.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid or expired token."));
        }
        Optional<UserDto> user = rbacService.getUser(payload.get().actorId());
        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "User not found."));
        }
        return ResponseEntity.ok(Map.of("user", backofficeMeService.buildMeUser(user.get())));
    }
}
