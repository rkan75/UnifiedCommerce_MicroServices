package com.tcs.commerce.products.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.tcs.commerce.products.service.AdminCurrencyService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin currency row updates (tax-inclusive flag, remove from store supported list).
 */
@RestController
@RequestMapping(value = "/admin/currencies", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminCurrencyController {

    private final AdminCurrencyService adminCurrencyService;

    public AdminCurrencyController(AdminCurrencyService adminCurrencyService) {
        this.adminCurrencyService = adminCurrencyService;
    }

    @PatchMapping(value = "/{code}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> patchCurrency(
        @PathVariable("code") String code,
        @RequestBody JsonNode body
    ) {
        adminCurrencyService.patchTaxInclusive(code, body);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @DeleteMapping("/{code}")
    public ResponseEntity<Map<String, Object>> removeStoreCurrency(@PathVariable("code") String code) {
        adminCurrencyService.removeStoreCurrencyLink(code);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
