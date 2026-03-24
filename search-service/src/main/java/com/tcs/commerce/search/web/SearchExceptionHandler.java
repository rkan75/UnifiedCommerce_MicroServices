package com.tcs.commerce.search.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Returns clear JSON errors when the database is unavailable or other failures occur,
 * so the storefront gets a proper response instead of an HTML stack trace.
 */
@RestControllerAdvice
public class SearchExceptionHandler {

    @ExceptionHandler(CannotGetJdbcConnectionException.class)
    public ResponseEntity<Map<String, String>> handleDatabaseUnavailable(CannotGetJdbcConnectionException ex) {
        String message = ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage();
        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "Database unavailable",
                        "message", message != null ? message : "Cannot connect to PostgreSQL. Ensure it is running and SPRING_DATASOURCE_* are set."
                ));
    }
}
