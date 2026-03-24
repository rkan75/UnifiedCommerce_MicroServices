package com.tcs.commerce.rbac.service;

import com.tcs.commerce.rbac.config.AdminAuthProperties;
import com.tcs.commerce.rbac.config.RbacProperties;
import com.tcs.commerce.rbac.security.AdminJwtHelper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class AdminAuthService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthService.class);

    private final JdbcTemplate jdbc;
    private final RbacProperties rbacProps;
    private final AdminAuthProperties authProps;
    private final AdminJwtHelper jwtHelper;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AdminAuthService(JdbcTemplate jdbc, RbacProperties rbacProps, AdminAuthProperties authProps, AdminJwtHelper jwtHelper) {
        this.jdbc = jdbc;
        this.rbacProps = rbacProps;
        this.authProps = authProps;
        this.jwtHelper = jwtHelper;
    }

    /**
     * Login: verify email/password against admin_credential, return JWT or specific failure reason.
     */
    public LoginResult login(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            log.info("Login: rejected - missing email or password");
            return LoginResult.noCredential();
        }
        email = email.trim().toLowerCase();
        String credTable = authProps.qualifiedCredentialTable(rbacProps.getTableSchema());
        String sql = "SELECT user_id, password_hash FROM " + credTable + " WHERE LOWER(email) = ?";
        var row = jdbc.query(sql, (rs, i) -> new Object[]{ rs.getString("user_id"), rs.getString("password_hash") }, email);
        if (row == null || row.isEmpty()) {
            log.info("Login: no credential row for email '{}' - register with create-admin-user (with ADMIN_RBAC_SERVICE_URL) or POST /auth/admin/register-credential", email);
            return LoginResult.noCredential();
        }
        Object[] r = row.get(0);
        String userId = (String) r[0];
        String hash = (String) r[1];
        if (userId == null || hash == null) {
            log.warn("Login: credential row has null user_id or password_hash for email");
            return LoginResult.noCredential();
        }
        if (!passwordEncoder.matches(password, hash)) {
            log.info("Login: password mismatch for email '{}' - check password or re-register with POST /auth/admin/register-credential", email);
            return LoginResult.badPassword();
        }
        Optional<String> token = jwtHelper.generateToken(userId, userId);
        if (token.isEmpty()) {
            log.error("Login: JWT generation failed (check ADMIN_JWT_SECRET is set and has enough length)");
            return LoginResult.jwtFailed();
        }
        return LoginResult.ok(token.get());
    }

    /**
     * Register credential for an existing admin user (called by backend after create-admin-user or invite accept).
     */
    @Transactional
    public boolean registerCredential(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) return false;
        email = email.trim().toLowerCase();
        String userTable = rbacProps.qualifiedUserTable();
        String credTable = authProps.qualifiedCredentialTable(rbacProps.getTableSchema());
        var userIdRow = jdbc.query("SELECT id FROM " + userTable + " WHERE LOWER(email) = ?", (rs, i) -> rs.getString("id"), email);
        if (userIdRow == null || userIdRow.isEmpty()) return false;
        String userId = userIdRow.get(0);
        if (userId == null) return false;
        String hash = passwordEncoder.encode(password);
        String id = "acred_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        try {
            jdbc.update("INSERT INTO " + credTable + " (id, user_id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW()) ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email, updated_at = NOW()", id, userId, email, hash);
        } catch (Exception e) {
            return false;
        }
        return true;
    }
}
