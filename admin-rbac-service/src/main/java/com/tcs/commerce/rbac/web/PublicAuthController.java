package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.config.AuthFlowProperties;
import com.tcs.commerce.rbac.security.AdminJwtHelper;
import com.tcs.commerce.rbac.service.AdminAuthService;
import com.tcs.commerce.rbac.service.AuthEmailNotificationService;
import com.tcs.commerce.rbac.service.InviteRegistrationService;
import com.tcs.commerce.rbac.service.RbacService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Unauthenticated flows: invite registration, password reset, optional password change when logged in.
 */
@RestController
public class PublicAuthController {

    private final RbacService rbacService;
    private final AdminAuthService adminAuthService;
    private final InviteRegistrationService inviteRegistrationService;
    private final AuthFlowProperties authFlowProps;
    private final AdminJwtHelper jwtHelper;
    private final AuthEmailNotificationService authEmailNotificationService;

    public PublicAuthController(
            RbacService rbacService,
            AdminAuthService adminAuthService,
            InviteRegistrationService inviteRegistrationService,
            AuthFlowProperties authFlowProps,
            AdminJwtHelper jwtHelper,
            AuthEmailNotificationService authEmailNotificationService) {
        this.rbacService = rbacService;
        this.adminAuthService = adminAuthService;
        this.inviteRegistrationService = inviteRegistrationService;
        this.authFlowProps = authFlowProps;
        this.jwtHelper = jwtHelper;
        this.authEmailNotificationService = authEmailNotificationService;
    }

    /**
     * Public: validate invite token (for registration page).
     */
    @GetMapping("/auth/invite/info")
    public ResponseEntity<?> inviteInfo(@RequestParam String token) {
        var inv = rbacService.findPendingInviteByToken(token);
        if (inv.isEmpty()) {
            return ResponseEntity.ok(Map.of("valid", false, "message", "Invalid or expired invite."));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valid", true);
        body.put("email", inv.get().getEmail());
        body.put("expires_at", inv.get().getExpires_at());
        return ResponseEntity.ok(body);
    }

    /**
     * Public: complete invite — creates user + admin_credential; no roles unless configured.
     */
    @PostMapping("/auth/invite/register")
    public ResponseEntity<?> inviteRegister(@RequestBody Map<String, Object> body) {
        String token = body != null && body.get("token") != null ? String.valueOf(body.get("token")).trim() : "";
        String password = body != null && body.get("password") != null ? String.valueOf(body.get("password")) : "";
        String first = body != null && body.get("first_name") != null ? String.valueOf(body.get("first_name")) : null;
        String last = body != null && body.get("last_name") != null ? String.valueOf(body.get("last_name")) : null;
        try {
            InviteRegistrationService.InviteRegistrationResult result =
                inviteRegistrationService.registerFromInvite(token, password, first, last);
            if (!result.ok()) {
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("message", result.message()));
            }
            return ResponseEntity.ok(Map.of("ok", true, "user_id", result.userId(), "message", "Registration complete. You can sign in. An administrator can assign roles."));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Request password reset. Always returns 200 when email format is ok (no enumeration).
     */
    @PostMapping("/auth/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body != null && body.get("email") != null ? body.get("email").trim().toLowerCase() : "";
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("ok", true);
        res.put("message", "If an account exists for this email, reset instructions have been processed.");
        if (email.isBlank() || !email.contains("@")) {
            return ResponseEntity.ok(res);
        }
        Optional<String> resetJwt = adminAuthService.issuePasswordResetToken(email);
        if (resetJwt.isPresent()) {
            if (authFlowProps.isExposePasswordResetTokenInResponse()) {
                res.put("reset_token", resetJwt.get());
            }
            String url = authFlowProps.passwordResetPageUrl(resetJwt.get());
            if (!url.isEmpty()) {
                res.put("reset_url", url);
                authEmailNotificationService.sendPasswordResetEmail(email, url);
            }
        }
        return ResponseEntity.ok(res);
    }

    @PostMapping("/auth/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token = body != null && body.get("token") != null ? body.get("token").trim() : "";
        String newPassword = body != null && body.get("password") != null ? body.get("password") : "";
        if (token.isBlank() || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "token and password (min 8 chars) required."));
        }
        if (!adminAuthService.resetPasswordWithToken(token, newPassword)) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("message", "Invalid or expired reset link."));
        }
        return ResponseEntity.ok(Map.of("ok", true, "message", "Password updated. You can sign in."));
    }

    /**
     * Authenticated: change password (Bearer admin JWT).
     */
    @PostMapping("/auth/change-password")
    public ResponseEntity<?> changePassword(HttpServletRequest request, @RequestBody Map<String, String> body) {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Missing Authorization."));
        }
        String jwt = auth.substring(7).trim();
        Optional<AdminJwtHelper.AdminTokenPayload> payload = jwtHelper.validateToken(jwt);
        if (payload.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid session."));
        }
        String current = body != null && body.get("current_password") != null ? body.get("current_password") : "";
        String newPass = body != null && body.get("new_password") != null ? body.get("new_password") : "";
        if (newPass.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "new_password must be at least 8 characters."));
        }
        if (!adminAuthService.changePassword(payload.get().actorId(), current, newPass)) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("message", "Current password incorrect or no credential on file."));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
