package com.tcs.commerce.products.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.tcs.commerce.products.service.AdminStoreService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin store row (Medusa {@code store}): read and update defaults for the dashboard Store settings page.
 */
@RestController
@RequestMapping(value = "/admin/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminStoreController {

    private final AdminStoreService adminStoreService;

    public AdminStoreController(AdminStoreService adminStoreService) {
        this.adminStoreService = adminStoreService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStore() {
        return ResponseEntity.ok(adminStoreService.getStoreAdmin());
    }

    @PatchMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> patchStore(@RequestBody JsonNode body) {
        return ResponseEntity.ok(adminStoreService.patchStore(body));
    }
}
