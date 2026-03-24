package com.tcs.commerce.customer.web;

import java.util.Optional;

/** Result of register: success with token, email already exists, JWT generation failed, or partial (customer created but auth insert failed). */
public final class RegisterResult {

    public enum Status { OK, ALREADY_EXISTS, JWT_ERROR, PARTIAL }

    private final Status status;
    private final String token;

    private RegisterResult(Status status, String token) {
        this.status = status;
        this.token = token;
    }

    public static RegisterResult ok(String token) {
        return new RegisterResult(Status.OK, token);
    }

    public static RegisterResult alreadyExists() {
        return new RegisterResult(Status.ALREADY_EXISTS, null);
    }

    public static RegisterResult jwtError() {
        return new RegisterResult(Status.JWT_ERROR, null);
    }

    /** Customer row was created but auth insert failed (e.g. duplicate). Ask user to try logging in. */
    public static RegisterResult partial() {
        return new RegisterResult(Status.PARTIAL, null);
    }

    public Status getStatus() {
        return status;
    }

    public Optional<String> getToken() {
        return Optional.ofNullable(token);
    }
}
