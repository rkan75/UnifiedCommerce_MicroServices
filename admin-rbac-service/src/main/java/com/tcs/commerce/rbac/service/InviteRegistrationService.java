package com.tcs.commerce.rbac.service;

import com.tcs.commerce.rbac.config.AuthFlowProperties;
import com.tcs.commerce.rbac.config.RbacProperties;
import com.tcs.commerce.rbac.web.InviteDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Completes invite flow: creates {@code user} row, {@code admin_credential}, marks invite accepted.
 * No RBAC roles unless {@link AuthFlowProperties#getDefaultRoleIdOnInviteRegister()} is set — admins assign roles later.
 */
@Service
public class InviteRegistrationService {

    private static final Logger log = LoggerFactory.getLogger(InviteRegistrationService.class);

    private final JdbcTemplate jdbc;
    private final RbacProperties rbacProps;
    private final AuthFlowProperties authFlowProps;
    private final RbacService rbacService;
    private final AdminAuthService adminAuthService;

    public InviteRegistrationService(
            JdbcTemplate jdbc,
            RbacProperties rbacProps,
            AuthFlowProperties authFlowProps,
            RbacService rbacService,
            AdminAuthService adminAuthService) {
        this.jdbc = jdbc;
        this.rbacProps = rbacProps;
        this.authFlowProps = authFlowProps;
        this.rbacService = rbacService;
        this.adminAuthService = adminAuthService;
    }

    public record InviteRegistrationResult(boolean ok, String message, String userId) {
        public static InviteRegistrationResult ok(String userId) {
            return new InviteRegistrationResult(true, null, userId);
        }
        public static InviteRegistrationResult fail(String message) {
            return new InviteRegistrationResult(false, message, null);
        }
    }

    @Transactional
    public InviteRegistrationResult registerFromInvite(String inviteToken, String password, String firstName, String lastName) {
        if (inviteToken == null || inviteToken.isBlank()) {
            return InviteRegistrationResult.fail("Invite token is required.");
        }
        if (password == null || password.length() < 8) {
            return InviteRegistrationResult.fail("Password must be at least 8 characters.");
        }
        Optional<InviteDto> inviteOpt = rbacService.findPendingInviteByToken(inviteToken.trim());
        if (inviteOpt.isEmpty()) {
            return InviteRegistrationResult.fail("Invalid or expired invite, or invite already used.");
        }
        InviteDto invite = inviteOpt.get();
        String email = invite.getEmail() != null ? invite.getEmail().trim().toLowerCase() : "";
        if (email.isBlank()) {
            return InviteRegistrationResult.fail("Invite has no email.");
        }
        String userTable = rbacProps.qualifiedUserTable();
        Long existing = jdbc.queryForObject("SELECT COUNT(*) FROM " + userTable + " WHERE LOWER(email) = ?", Long.class, email);
        if (existing != null && existing > 0) {
            return InviteRegistrationResult.fail("A user with this email already exists.");
        }

        String userId = "user_" + UUID.randomUUID().toString().replace("-", "").substring(0, 26);
        insertUserRow(userId, email, firstName, lastName);

        if (!adminAuthService.registerCredential(email, password)) {
            log.warn("registerCredential failed after user insert for email {}", email);
            throw new IllegalStateException("Could not save login credential.");
        }

        rbacService.markInviteAccepted(invite.getId());

        String defaultRole = authFlowProps.getDefaultRoleIdOnInviteRegister();
        if (defaultRole != null && !defaultRole.isBlank()) {
            String linkTable = rbacProps.qualifiedUserRoleLinkTable();
            try {
                jdbc.update("INSERT INTO " + linkTable + " (user_id, rbac_role_id) VALUES (?, ?)", userId, defaultRole);
            } catch (Exception e) {
                log.warn("Could not assign default role {} to user {}: {}", defaultRole, userId, e.getMessage());
            }
        }

        return InviteRegistrationResult.ok(userId);
    }

    private void insertUserRow(String id, String email, String firstName, String lastName) {
        String userTable = rbacProps.qualifiedUserTable();
        String fn = blankToNull(firstName);
        String ln = blankToNull(lastName);
        try {
            jdbc.update(
                "INSERT INTO " + userTable + " (id, email, first_name, last_name, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, NOW(), NOW(), CAST(? AS jsonb))",
                id, email, fn, ln, "{}"
            );
        } catch (Exception e) {
            log.debug("User insert with metadata failed (retrying minimal columns): {}", e.getMessage());
            jdbc.update(
                "INSERT INTO " + userTable + " (id, email, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
                id, email, fn, ln
            );
        }
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
