package com.tcs.commerce.categories.web;

import com.tcs.commerce.categories.service.CategoriesService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Store API product categories: GET /store/product-categories (list and by handle). Medusa replacement.
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class CategoriesController {

    private final CategoriesService categoriesService;

    public CategoriesController(CategoriesService categoriesService) {
        this.categoriesService = categoriesService;
    }

    @GetMapping("/product-categories")
    public ResponseEntity<Map<String, List<ProductCategoryDto>>> listCategories(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) String handle,
        @RequestParam(required = false) String fields
    ) {
        if (handle != null && !handle.isBlank()) {
            List<ProductCategoryDto> list = categoriesService.getCategoriesByHandle(handle.trim());
            return ResponseEntity.ok(Map.of("product_categories", list));
        }
        List<ProductCategoryDto> list = categoriesService.listCategories(limit);
        return ResponseEntity.ok(Map.of("product_categories", list));
    }

    /** Create category (for store backend scripts; replaces Medusa createProductCategories). */
    @PostMapping(value = "/product-categories", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, ProductCategoryDto>> createCategory(@RequestBody Map<String, Object> body) {
        String name = body != null && body.get("name") != null ? body.get("name").toString().trim() : null;
        if (name == null || name.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        String handle = body != null && body.get("handle") != null ? body.get("handle").toString().trim() : null;
        Boolean isActive = body != null && body.get("is_active") != null
            ? Boolean.parseBoolean(body.get("is_active").toString())
            : true;
        ProductCategoryDto created = categoriesService.createCategory(name, handle, isActive);
        return ResponseEntity.ok(Map.of("product_category", created));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "categories-service"));
    }
}
