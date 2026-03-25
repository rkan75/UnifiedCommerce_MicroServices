package com.tcs.commerce.rbac.security;

import com.tcs.commerce.rbac.config.AdminAuthProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

/**
 * Issue and validate JWT for admin users. Payload matches what the store backend
 * validateJwt expects: actor_id (user id), auth_identity_id, actor_type=user.
 */
@Component
public class AdminJwtHelper {

    private final AdminAuthProperties props;

    public AdminJwtHelper(AdminAuthProperties props) {
        this.props = props;
    }

    public Optional<String> generateToken(String userId, String authIdentityId) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank() || userId == null || userId.isBlank()) return Optional.empty();
        String aid = (authIdentityId != null && !authIdentityId.isBlank()) ? authIdentityId : userId;
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            long now = System.currentTimeMillis();
            long exp = props.getJwtExpiresSeconds() > 0 ? props.getJwtExpiresSeconds() * 1000L : 604800_000L;
            String token = Jwts.builder()
                .subject(aid)
                .claim("actor_id", userId)
                .claim("auth_identity_id", aid)
                .claim("actor_type", "user")
                .issuedAt(new Date(now))
                .expiration(new Date(now + exp))
                .signWith(key)
                .compact();
            return Optional.of(token);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<AdminTokenPayload> validateToken(String token) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank() || token == null || token.isBlank()) return Optional.empty();
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token.trim())
                .getPayload();
            if ("password_reset".equals(claims.get("purpose", String.class))) {
                return Optional.empty();
            }
            String actorId = claims.get("actor_id", String.class);
            String authIdentityId = claims.get("auth_identity_id", String.class);
            if (actorId == null || actorId.isBlank()) actorId = authIdentityId;
            if (actorId == null || actorId.isBlank()) return Optional.empty();
            return Optional.of(new AdminTokenPayload(actorId, authIdentityId != null ? authIdentityId : actorId));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Stateless password-reset link token (do not use for login).
     */
    public Optional<String> generatePasswordResetToken(String userId) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank() || userId == null || userId.isBlank()) return Optional.empty();
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            long now = System.currentTimeMillis();
            long expMs = props.getPasswordResetExpiresSeconds() > 0
                ? props.getPasswordResetExpiresSeconds() * 1000L
                : 3600_000L;
            return Optional.of(Jwts.builder()
                .subject(userId)
                .claim("purpose", "password_reset")
                .claim("actor_id", userId)
                .issuedAt(new Date(now))
                .expiration(new Date(now + expMs))
                .signWith(key)
                .compact());
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<String> validatePasswordResetTokenAndGetUserId(String token) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank() || token == null || token.isBlank()) return Optional.empty();
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token.trim())
                .getPayload();
            if (!"password_reset".equals(claims.get("purpose", String.class))) return Optional.empty();
            String userId = claims.get("actor_id", String.class);
            if (userId == null || userId.isBlank()) userId = claims.getSubject();
            if (userId == null || userId.isBlank()) return Optional.empty();
            return Optional.of(userId);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public record AdminTokenPayload(String actorId, String authIdentityId) {}
}
