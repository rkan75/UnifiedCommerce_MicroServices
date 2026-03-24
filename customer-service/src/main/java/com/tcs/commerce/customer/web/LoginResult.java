package com.tcs.commerce.customer.web;

import java.util.Optional;

/** Result of login: success with token, user not found, wrong password, or JWT generation failed. */
public final class LoginResult {

    public enum Status { OK, NOT_FOUND, BAD_PASSWORD, JWT_ERROR }

    private final Status status;
    private final String token;

    private LoginResult(Status status, String token) {
        this.status = status;
        this.token = token;
    }

    public static LoginResult ok(String token) {
        return new LoginResult(Status.OK, token);
    }

    public static LoginResult notFound() {
        return new LoginResult(Status.NOT_FOUND, null);
    }

    public static LoginResult badPassword() {
        return new LoginResult(Status.BAD_PASSWORD, null);
    }

    public static LoginResult jwtError() {
        return new LoginResult(Status.JWT_ERROR, null);
    }

    public Status getStatus() {
        return status;
    }

    public Optional<String> getToken() {
        return Optional.ofNullable(token);
    }
}
