package com.tcs.commerce.products.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.tcs.commerce.products.service.AdminRegionService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Admin regions backed by the Medusa {@code region} table.
 */
@RestController
@RequestMapping(value = "/admin/regions", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminRegionsController {

    private final AdminRegionService adminRegionService;

    public AdminRegionsController(AdminRegionService adminRegionService) {
        this.adminRegionService = adminRegionService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        return ResponseEntity.ok(adminRegionService.listRegionsAdminResponse());
    }

    /**
     * Paginated ISO catalog (Medusa v2 {@code region_country} by default). Path avoids {@code /{id}} collision.
     */
    @GetMapping("/meta/countries")
    public ResponseEntity<Map<String, Object>> countryCatalog(
        @RequestParam(required = false) String q,
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        return ResponseEntity.ok(adminRegionService.listCountryCatalog(q, limit, offset));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(@RequestBody JsonNode body) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("region", adminRegionService.createRegion(body));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getOne(@PathVariable String id) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("region", adminRegionService.getRegionAdmin(id));
        return ResponseEntity.ok(out);
    }

    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> patch(@PathVariable String id, @RequestBody JsonNode body) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("region", adminRegionService.patchRegion(id, body));
        return ResponseEntity.ok(out);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id) {
        adminRegionService.deleteRegion(id);
        return ResponseEntity.ok(Collections.singletonMap("deleted", Boolean.TRUE));
    }
}
