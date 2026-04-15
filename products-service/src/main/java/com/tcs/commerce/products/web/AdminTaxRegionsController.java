package com.tcs.commerce.products.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.tcs.commerce.products.service.AdminTaxRegionService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Admin tax regions backed by Medusa {@code tax_region} / {@code tax_rate} / {@code tax_provider} tables.
 */
@RestController
@RequestMapping(value = "/admin/tax-regions", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminTaxRegionsController {

    private final AdminTaxRegionService adminTaxRegionService;

    public AdminTaxRegionsController(AdminTaxRegionService adminTaxRegionService) {
        this.adminTaxRegionService = adminTaxRegionService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        return ResponseEntity.ok(adminTaxRegionService.listTaxRegionsAdminResponse());
    }

    @GetMapping("/meta/providers")
    public ResponseEntity<Map<String, Object>> providers() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("providers", adminTaxRegionService.listTaxProviders());
        return ResponseEntity.ok(out);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(@RequestBody JsonNode body) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tax_region", adminTaxRegionService.createTaxRegion(body));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getOne(@PathVariable String id) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tax_region", adminTaxRegionService.getTaxRegionAdmin(id));
        return ResponseEntity.ok(out);
    }

    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> patch(@PathVariable String id, @RequestBody JsonNode body) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tax_region", adminTaxRegionService.patchTaxRegion(id, body));
        return ResponseEntity.ok(out);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id) {
        adminTaxRegionService.deleteTaxRegion(id);
        return ResponseEntity.ok(Map.of("deleted", Boolean.TRUE));
    }
}
