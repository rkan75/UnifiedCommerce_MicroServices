package com.tcs.commerce.search.web;

import java.util.Map;

import com.tcs.commerce.search.config.SearchProperties;
import com.tcs.commerce.search.service.ProductSearchService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for item search. Compatible with storefront expectations:
 * GET /search?q=...&priceMin=...&priceMax=...&region_id=...&limit=...&offset=...
 * Returns { products: [...], count: N } for drop-in use with Next.js storefront.
 */
@RestController
@RequestMapping(value = "/search", produces = MediaType.APPLICATION_JSON_VALUE)
public class SearchController {

    private final ProductSearchService searchService;
    private final SearchProperties props;

    public SearchController(ProductSearchService searchService, SearchProperties props) {
        this.searchService = searchService;
        this.props = props;
    }

    @GetMapping
    public ResponseEntity<SearchResponse> search(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String id,
        @RequestParam(required = false) Double priceMin,
        @RequestParam(required = false) Double priceMax,
        @RequestParam(required = false, name = "region_id") String regionId,
        @RequestParam(required = false, name = "category_id") String categoryId,
        @RequestParam(required = false, name = "collection_id") String collectionId,
        @RequestParam(defaultValue = "12") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        // Product-by-ID lookup (e.g. admin search by prod_xxx)
        if (id != null && !id.isBlank()) {
            SearchResponse response = searchService.getById(id.trim());
            return ResponseEntity.ok(response);
        }
        int safeLimit = Math.min(Math.max(1, limit), props.getMaxLimit());
        SearchResponse response = searchService.search(
            q, priceMin, priceMax, regionId, categoryId, collectionId, safeLimit, offset
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "search-service"));
    }
}
