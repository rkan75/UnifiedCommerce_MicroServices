package com.tcs.commerce.products.service;

import org.springframework.http.HttpStatus;

/**
 * Domain error for admin product create (validation, duplicate handle, etc.).
 */
public class ProductWriteException extends RuntimeException {

    private final HttpStatus status;

    public ProductWriteException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
