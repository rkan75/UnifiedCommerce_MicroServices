package com.tcs.commerce.products.web;

import com.tcs.commerce.products.service.ProductsService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Exposes GET /store/products and GET /store/product-variants compatible with Medusa Store API.
 * Query params for products: limit, offset, region_id, handle, id, q, category_id, collection_id, order.
 * Response: { products: [...], count: N } or { variant: {...} } / { variants: [...] }.
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class ProductsController {

    private final ProductsService productsService;

    public ProductsController(ProductsService productsService) {
        this.productsService = productsService;
    }

    @GetMapping("/products")
    public ResponseEntity<ProductsResponse> getProducts(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) Integer offset,
        @RequestParam(required = false, name = "region_id") String regionId,
        @RequestParam(required = false) String handle,
        @RequestParam(required = false) List<String> id,
        @RequestParam(required = false) String q,
        @RequestParam(required = false, name = "category_id") String categoryId,
        @RequestParam(required = false, name = "category_handle") String categoryHandle,
        @RequestParam(required = false, name = "collection_id") String collectionId,
        @RequestParam(required = false) String order,
        @RequestParam(required = false) String fields
    ) {
        // "fields" (Medusa sparse fieldset) is ignored; response is full StoreProduct-like shape.
        ProductsResponse response = productsService.getProducts(
            handle,
            id,
            q,
            categoryId,
            categoryHandle,
            collectionId,
            regionId,
            limit,
            offset,
            order
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/product-variants/{variantId}")
    public ResponseEntity<Map<String, VariantResponseDto>> getVariant(
        @PathVariable String variantId,
        @RequestParam(required = false, name = "region_id") String regionId
    ) {
        VariantResponseDto variant = productsService.getVariantById(variantId, regionId);
        if (variant == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("variant", variant));
    }

    @GetMapping("/product-variants")
    public ResponseEntity<Map<String, List<VariantResponseDto>>> getVariants(
        @RequestParam(required = false) List<String> id,
        @RequestParam(required = false, name = "region_id") String regionId
    ) {
        if (id == null || id.isEmpty()) {
            return ResponseEntity.ok(Map.of("variants", List.<VariantResponseDto>of()));
        }
        List<VariantResponseDto> variants = productsService.getVariantsByIds(id, regionId);
        return ResponseEntity.ok(Map.of("variants", variants));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "products-service"));
    }
}
