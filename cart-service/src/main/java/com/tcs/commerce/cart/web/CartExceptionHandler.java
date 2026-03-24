package com.tcs.commerce.cart.web;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class CartExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleUnprocessable(IllegalStateException e) {
        String msg = e.getMessage() != null ? e.getMessage() : "";
        if (msg.contains("commerce_cart") || msg.contains("commerce_line_item")) {
            if (msg.contains("bad SQL grammar") || msg.contains("does not exist") || msg.contains("relation")) {
                String help = "Cart tables not found. (1) Run: cd cart-service && ./run-schema.sh  (2) Ensure the cart service uses the SAME database—check the cart-service log for 'Cart service datasource: jdbc:postgresql://...' and run run-schema.sh against that host/port/db.";
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", help, "code", "CART_DB_ERROR", "detail", msg));
            }
        }
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("message", msg));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, String>> handleDataAccess(DataAccessException e) {
        String raw = e.getMessage();
        boolean missingTable = raw != null && (raw.contains("does not exist") || raw.contains("bad SQL grammar"));
        String message = missingTable
            ? "Cart tables not found. (1) Run: cd cart-service && ./run-schema.sh  (2) Ensure the cart service uses the SAME database—check the cart-service log for 'Cart service datasource: jdbc:postgresql://...' and run run-schema.sh against that host/port/db."
            : (raw != null ? raw : "Database error");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of("message", message, "code", "CART_DB_ERROR", "detail", raw != null ? raw : ""));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleAny(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            message = e.getCause() != null && e.getCause().getMessage() != null && !e.getCause().getMessage().isBlank()
                ? e.getCause().getMessage()
                : e.getClass().getSimpleName();
        }
        if (message == null || message.isBlank()) message = "Internal error";
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("message", message, "code", "CART_ERROR"));
    }
}
