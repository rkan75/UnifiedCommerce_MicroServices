package com.tcs.commerce.customer.service;

import com.tcs.commerce.customer.config.CustomerProperties;
import com.tcs.commerce.customer.security.JwtHelper;
import com.tcs.commerce.customer.web.LoginResult;
import com.tcs.commerce.customer.web.RegisterResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Auth: register, login, password reset. No Medusa dependency.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    private final JdbcTemplate jdbc;
    private final CustomerProperties props;
    private final JwtHelper jwtHelper;

    public AuthService(JdbcTemplate jdbc, CustomerProperties props, JwtHelper jwtHelper) {
        this.jdbc = jdbc;
        this.props = props;
        this.jwtHelper = jwtHelper;
    }

    private String authTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getAuthTable() != null && !props.getAuthTable().isBlank()) ? props.getAuthTable().trim() : "customer_auth";
        return schema + "." + tbl.replaceAll("[^a-zA-Z0-9_]", "");
    }

    private String customerTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getCustomerTable() != null && !props.getCustomerTable().isBlank()) ? props.getCustomerTable().trim() : "customer";
        return schema + "." + tbl.replaceAll("[^a-zA-Z0-9_]", "");
    }

    /** Register: create customer + auth row, return result (OK with JWT, already exists, or JWT generation failed). */
    public RegisterResult register(String email, String password, String firstName, String lastName, String phone) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return RegisterResult.alreadyExists(); // treat as generic failure
        }
        String normalizedEmail = email.trim().toLowerCase();
        String cTbl = customerTable();
        String aTbl = authTable();
        if (findAuthByEmail(normalizedEmail, aTbl) != null) {
            return RegisterResult.alreadyExists();
        }
        String customerId = "cus_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String authId = "auth_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String hash = ENCODER.encode(password);
        try {
            jdbc.update(
                "INSERT INTO " + cTbl + " (id, email, first_name, last_name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
                customerId, normalizedEmail, firstName != null ? firstName.trim() : "", lastName != null ? lastName.trim() : "", phone != null ? phone.trim() : null
            );
        } catch (Exception e) {
            try {
                jdbc.update("INSERT INTO " + cTbl + " (id, email, created_at, updated_at) VALUES (?, ?, NOW(), NOW())", customerId, normalizedEmail);
            } catch (Exception e2) {
                return RegisterResult.alreadyExists();
            }
        }
        try {
            jdbc.update(
                "INSERT INTO " + aTbl + " (id, customer_id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
                authId, customerId, normalizedEmail, hash
            );
            var tokenOpt = jwtHelper.generateToken(customerId, authId);
            if (tokenOpt.isPresent()) {
                return RegisterResult.ok(tokenOpt.get());
            }
            return RegisterResult.jwtError(); // customer+auth created but JWT failed (e.g. JWT_SECRET not set)
        } catch (Exception e) {
            // Customer was inserted but auth insert failed. Log so admin can fix (e.g. create customer_auth table).
            log.error("Auth insert failed after customer created. Ensure customer_auth table exists (run schema-auth.sql). Error: {}", e.getMessage(), e);
            return RegisterResult.partial();
        }
    }

    /** Login: verify password, return result (OK with JWT, not found, bad password, or JWT failed). */
    public LoginResult login(String email, String password) {
        if (email == null || email.isBlank() || password == null) return LoginResult.badPassword();
        String normalizedEmail = email.trim().toLowerCase();
        String aTbl = authTable();
        String[] auth = findAuthByEmail(normalizedEmail, aTbl);
        if (auth == null) {
            log.info("Login: no auth row for email (check customer_auth table and that user registered via this service). Email: {}", normalizedEmail);
            return LoginResult.notFound();
        }
        String customerId = auth[0];
        String hash = auth[1];
        if (hash == null || hash.isBlank()) {
            log.warn("Login: password_hash is null/empty for email {}. User may have been created outside this service.", normalizedEmail);
            return LoginResult.badPassword();
        }
        if (!ENCODER.matches(password, hash)) {
            log.info("Login: password mismatch for email {}", normalizedEmail);
            return LoginResult.badPassword();
        }
        var tokenOpt = jwtHelper.generateToken(customerId, auth[2]);
        if (tokenOpt.isPresent()) return LoginResult.ok(tokenOpt.get());
        log.error("Login: JWT generation failed for email {} (is JWT_SECRET set?).", normalizedEmail);
        return LoginResult.jwtError();
    }

    /** [customerId, passwordHash, authId] or null */
    private String[] findAuthByEmail(String normalizedEmail, String aTbl) {
        try {
            return jdbc.query(
                "SELECT customer_id, password_hash, id FROM " + aTbl + " WHERE LOWER(TRIM(email)) = ? LIMIT 1",
                (rs, rowNum) -> new String[]{ rs.getString(1), rs.getString(2), rs.getString(3) },
                normalizedEmail
            ).stream().findFirst().orElse(null);
        } catch (Exception e) {
            log.warn("findAuthByEmail failed (table missing or wrong schema?): {}", e.getMessage());
            try {
                return jdbc.query(
                    "SELECT customer_id, password, id FROM " + aTbl + " WHERE LOWER(TRIM(email)) = ? LIMIT 1",
                    (rs, rowNum) -> new String[]{ rs.getString(1), rs.getString(2), rs.getString(3) },
                    normalizedEmail
                ).stream().findFirst().orElse(null);
            } catch (Exception e2) {
                return null;
            }
        }
    }

    /** Request password reset: store token and expiry. */
    public boolean requestPasswordReset(String email) {
        if (email == null || email.isBlank()) return false;
        String normalizedEmail = email.trim().toLowerCase();
        String aTbl = authTable();
        String token = UUID.randomUUID().toString().replace("-", "");
        Instant expires = Instant.now().plusSeconds(props.getResetTokenValidSeconds());
        try {
            int n = jdbc.update(
                "UPDATE " + aTbl + " SET reset_token = ?, reset_token_expires_at = ?, updated_at = NOW() WHERE LOWER(TRIM(email)) = ?",
                token, java.sql.Timestamp.from(expires), normalizedEmail
            );
            if (n > 0) {
                // TODO: send email with reset link containing token. For now we just store the token.
                return true;
            }
            return true; // don't reveal whether email exists
        } catch (Exception e) {
            return true;
        }
    }

    /** Reset password with token (from email link). */
    public boolean resetPasswordWithToken(String token, String newPassword) {
        if (token == null || token.isBlank() || newPassword == null || newPassword.isBlank()) return false;
        String aTbl = authTable();
        String hash = ENCODER.encode(newPassword);
        try {
            int n = jdbc.update(
                "UPDATE " + aTbl + " SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW() WHERE reset_token = ? AND reset_token_expires_at > NOW()",
                hash, token.trim()
            );
            return n > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
