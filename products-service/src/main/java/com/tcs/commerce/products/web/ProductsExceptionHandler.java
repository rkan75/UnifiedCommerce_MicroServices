package com.tcs.commerce.products.web;

import com.tcs.commerce.products.service.ProductWriteException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ProductsExceptionHandler {

    @ExceptionHandler(ProductWriteException.class)
    public ResponseEntity<Map<String, String>> handleProductWrite(ProductWriteException ex) {
        HttpStatus st = ex.getStatus() != null ? ex.getStatus() : HttpStatus.BAD_REQUEST;
        return ResponseEntity
            .status(st)
            .body(Map.of(
                "error", "Product write failed",
                "message", ex.getMessage() != null ? ex.getMessage() : st.getReasonPhrase()
            ));
    }

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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleOther(Exception ex) {
        String message = ex.getMessage();
        Throwable cause = ex.getCause();
        if (cause != null && cause.getMessage() != null) {
            message = message + "; " + cause.getMessage();
        }
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of(
                "error", "Internal Server Error",
                "message", message != null ? message : "Unexpected error. Check products-service logs.",
                "type", ex.getClass().getSimpleName()
            ));
    }
}
