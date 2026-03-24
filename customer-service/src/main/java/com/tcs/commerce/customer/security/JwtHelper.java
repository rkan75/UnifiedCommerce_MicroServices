package com.tcs.commerce.customer.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

/**
 * Validates and issues JWT for customer auth. Payload contains actor_id (customer id) and auth_identity_id.
 */
@Component
public class JwtHelper {

    private final String jwtSecret;
    private final long jwtExpiresSeconds;

    public JwtHelper(com.tcs.commerce.customer.config.CustomerProperties props) {
        this.jwtSecret = props.getJwtSecret() != null ? props.getJwtSecret().trim() : "";
        this.jwtExpiresSeconds = props.getJwtExpiresSeconds() > 0 ? props.getJwtExpiresSeconds() : 604800L;
    }

    /**
     * Extract customer id (actor_id) from Bearer token. Returns empty if invalid or missing.
     */
    public Optional<String> getCustomerIdFromBearer(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Optional.empty();
        }
        String token = authorization.substring(7).trim();
        if (token.isEmpty()) return Optional.empty();
        return getCustomerIdFromToken(token);
    }

    public Optional<String> getCustomerIdFromToken(String token) {
        if (jwtSecret.isEmpty()) return Optional.empty();
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
            // Medusa JWT: actor_id is the customer id for store customer
            String actorId = claims.get("actor_id", String.class);
            if (actorId != null && !actorId.isBlank()) {
                return Optional.of(actorId.trim());
            }
            // Fallback: auth_identity_id sometimes used as actor in some flows
            String authIdentityId = claims.get("auth_identity_id", String.class);
            if (authIdentityId != null && !authIdentityId.isBlank()) {
                return Optional.of(authIdentityId.trim());
            }
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** Generate JWT for customer (after login/register). */
    public Optional<String> generateToken(String customerId, String authIdentityId) {
        if (jwtSecret.isEmpty() || customerId == null || customerId.isBlank()) return Optional.empty();
        String aid = (authIdentityId != null && !authIdentityId.isBlank()) ? authIdentityId : customerId;
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            long now = System.currentTimeMillis();
            String token = Jwts.builder()
                .subject(aid)
                .claim("actor_id", customerId)
                .claim("auth_identity_id", aid)
                .claim("actor_type", "customer")
                .issuedAt(new Date(now))
                .expiration(new Date(now + jwtExpiresSeconds * 1000))
                .signWith(key)
                .compact();
            return Optional.of(token);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
