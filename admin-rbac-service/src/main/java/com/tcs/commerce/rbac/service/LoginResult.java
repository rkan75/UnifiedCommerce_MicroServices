package com.tcs.commerce.rbac.service;

import java.util.Optional;

/**
 * Result of admin login attempt so we can return specific error messages
 * instead of a generic "Invalid email or password" for JWT or config issues.
 */
public final class LoginResult {

    public enum Status {
        OK,
        NO_CREDENTIAL,
        BAD_PASSWORD,
        JWT_FAILED
    }

    private final Status status;
    private final String token;

    private LoginResult(Status status, String token) {
        this.status = status;
        this.token = token;
    }

    public static LoginResult ok(String token) {
        return new LoginResult(Status.OK, token);
    }

    public static LoginResult noCredential() {
        return new LoginResult(Status.NO_CREDENTIAL, null);
    }

    public static LoginResult badPassword() {
        return new LoginResult(Status.BAD_PASSWORD, null);
    }

    public static LoginResult jwtFailed() {
        return new LoginResult(Status.JWT_FAILED, null);
    }

    public Status getStatus() {
        return status;
    }

    public Optional<String> getToken() {
        return Optional.ofNullable(token);
    }
}
