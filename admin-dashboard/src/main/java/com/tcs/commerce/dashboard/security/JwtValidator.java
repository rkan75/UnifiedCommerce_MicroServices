package com.tcs.commerce.dashboard.security;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Validates JWT issued by admin-rbac-service (same secret). Used for session and protected routes.
 */
@Component
public class JwtValidator {

    private final DashboardProperties props;

    public JwtValidator(DashboardProperties props) {
        this.props = props;
    }

    public Optional<SessionPayload> validate(String token) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank() || token == null || token.isBlank()) return Optional.empty();
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token.trim())
                .getPayload();
            String actorId = claims.get("actor_id", String.class);
            String authIdentityId = claims.get("auth_identity_id", String.class);
            if (actorId == null || actorId.isBlank()) actorId = authIdentityId;
            if (actorId == null || actorId.isBlank()) return Optional.empty();
            return Optional.of(new SessionPayload(actorId, authIdentityId != null ? authIdentityId : actorId));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public record SessionPayload(String actorId, String authIdentityId) {}
}
