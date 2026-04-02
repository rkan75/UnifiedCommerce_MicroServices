package com.tcs.commerce.products.web;

import com.tcs.commerce.products.service.ProductWriteService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin helpers for catalog entities not under {@code /admin/products}.
 */
@RestController
@RequestMapping(value = "/admin/inventory-items", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminInventoryItemsController {

    private final ProductWriteService productWriteService;

    public AdminInventoryItemsController(ProductWriteService productWriteService) {
        this.productWriteService = productWriteService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        return ResponseEntity.ok(Map.of("items", productWriteService.listInventoryItemsForAdmin(400)));
    }
}
