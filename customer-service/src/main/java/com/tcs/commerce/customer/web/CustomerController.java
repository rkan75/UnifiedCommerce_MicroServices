package com.tcs.commerce.customer.web;

import com.tcs.commerce.customer.security.JwtHelper;
import com.tcs.commerce.customer.service.CustomerService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import org.springframework.web.bind.annotation.RequestMethod;
import java.util.Optional;

/**
 * Store API customers: GET/POST /store/customers/me, address CRUD (Medusa replacement).
 * Requires Authorization: Bearer &lt;token&gt; (Medusa-issued JWT). Set JWT_SECRET to match Medusa backend.
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class CustomerController {

    private final CustomerService customerService;
    private final JwtHelper jwtHelper;

    public CustomerController(CustomerService customerService, JwtHelper jwtHelper) {
        this.customerService = customerService;
        this.jwtHelper = jwtHelper;
    }

    private Optional<String> requireCustomerId(String authorization) {
        Optional<String> id = jwtHelper.getCustomerIdFromBearer(authorization);
        if (id.isEmpty()) {
            return Optional.empty();
        }
        return id;
    }

    @GetMapping("/customers/me")
    public ResponseEntity<?> getMe(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestParam(required = false) String fields
    ) {
        Optional<String> customerId = requireCustomerId(authorization);
        if (customerId.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        CustomerDto customer = customerService.getCustomerById(customerId.get());
        if (customer == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Customer not found"));
        }
        return ResponseEntity.ok(Map.of("customer", customer));
    }

    @RequestMapping(value = "/customers/me", method = { RequestMethod.POST, RequestMethod.PATCH }, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateMe(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestBody Map<String, Object> body
    ) {
        Optional<String> customerId = requireCustomerId(authorization);
        if (customerId.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        CustomerDto updated = customerService.updateCustomer(customerId.get(), body != null ? body : Map.of());
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("message", "Update failed"));
        }
        return ResponseEntity.ok(Map.of("customer", updated));
    }

    @PostMapping(value = "/customers/me/addresses", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createAddress(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestBody Map<String, Object> body
    ) {
        Optional<String> customerId = requireCustomerId(authorization);
        if (customerId.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        var result = customerService.createAddress(customerId.get(), body != null ? body : Map.of());
        if (result.getAddress().isEmpty()) {
            String msg = result.getErrorMessage().orElse("Create address failed");
            return ResponseEntity.status(400).body(Map.of("message", "Create address failed: " + msg));
        }
        return ResponseEntity.ok(Map.of("customer", customerService.getCustomerById(customerId.get())));
    }

    @PatchMapping(value = "/customers/me/addresses/{addressId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateAddress(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @PathVariable String addressId,
        @RequestBody Map<String, Object> body
    ) {
        Optional<String> customerId = requireCustomerId(authorization);
        if (customerId.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        CustomerAddressDto updated = customerService.updateAddress(customerId.get(), addressId, body != null ? body : Map.of());
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("message", "Update address failed"));
        }
        return ResponseEntity.ok(Map.of("customer", customerService.getCustomerById(customerId.get())));
    }

    @DeleteMapping("/customers/me/addresses/{addressId}")
    public ResponseEntity<?> deleteAddress(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @PathVariable String addressId
    ) {
        Optional<String> customerId = requireCustomerId(authorization);
        if (customerId.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        boolean deleted = customerService.deleteAddress(customerId.get(), addressId);
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("message", "Address not found"));
        }
        return ResponseEntity.ok(Map.of("customer", customerService.getCustomerById(customerId.get())));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "customer-service"));
    }
}
