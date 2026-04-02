package com.tcs.commerce.products.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.tcs.commerce.products.service.ProductWriteService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin product persistence (no Medusa API server): POST create matches Medusa Admin product-create flow.
 *
 * @see <a href="https://docs.medusajs.com/user-guide/products/create">Medusa User Guide — Create Product</a>
 */
@RestController
@RequestMapping(value = "/admin/products", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminProductWriteController {

    private final ProductWriteService productWriteService;

    public AdminProductWriteController(ProductWriteService productWriteService) {
        this.productWriteService = productWriteService;
    }

    /**
     * Create a single product (JSON body aligned with admin dashboard / StoreProduct-like shape).
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createProduct(@RequestBody JsonNode body) {
        ProductWriteService.CreatedProduct c = productWriteService.createFromAdminJson(body);
        return ResponseEntity.ok(Map.of(
            "product_id", c.id(),
            "handle", c.handle()
        ));
    }

    /**
     * Partial update of product details (admin drawer: status, title, subtitle, handle, material, description, discountable).
     */
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateProduct(@PathVariable String id, @RequestBody JsonNode body) {
        productWriteService.updateProductDetails(id, body);
        return ResponseEntity.ok(Map.of("product_id", id));
    }

    /**
     * Create a variant on an existing product (admin PDP wizard: details, prices, optional inventory kit).
     */
    @PostMapping(value = "/{id}/variants", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createVariant(@PathVariable String id, @RequestBody JsonNode body) {
        String variantId = productWriteService.addVariantToProduct(id, body);
        return ResponseEntity.ok(Map.of("variant_id", variantId, "product_id", id));
    }

    /**
     * Sibling variants’ linked inventory lines with option labels (Color, Size, …) for the create-variant kit step.
     */
    @GetMapping("/{id}/inventory-kit-candidates")
    public ResponseEntity<Map<String, Object>> inventoryKitCandidates(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("components", productWriteService.listInventoryKitCandidates(id)));
    }

    /**
     * Create many products (e.g. CSV import). Each item uses the same JSON shape as {@link #createProduct}.
     * Per-item failures do not roll back successful creates.
     */
    @PostMapping(value = "/batch", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createBatch(@RequestBody JsonNode body) {
        JsonNode arr = body.get("products");
        if (arr == null || !arr.isArray()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Expected { \"products\": [ ... ] }"));
        }
        List<String> ids = new ArrayList<>();
        List<Map<String, String>> errors = new ArrayList<>();
        int ok = 0;
        for (int i = 0; i < arr.size(); i++) {
            try {
                ProductWriteService.CreatedProduct c = productWriteService.createFromAdminJson(arr.get(i));
                ids.add(c.id());
                ok++;
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                errors.add(Map.of("index", String.valueOf(i), "message", msg));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("created", ok);
        out.put("product_ids", ids);
        out.put("errors", errors);
        return ResponseEntity.ok(out);
    }
}
