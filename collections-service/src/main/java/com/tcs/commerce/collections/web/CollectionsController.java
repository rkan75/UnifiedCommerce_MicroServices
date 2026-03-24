package com.tcs.commerce.collections.web;

import com.tcs.commerce.collections.service.CollectionsService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Store API collections: GET /store/collections (list and by handle) and GET /store/collections/:id. Medusa replacement.
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class CollectionsController {

    private final CollectionsService collectionsService;

    public CollectionsController(CollectionsService collectionsService) {
        this.collectionsService = collectionsService;
    }

    @GetMapping("/collections")
    public ResponseEntity<Map<String, List<CollectionDto>>> listCollections(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) Integer offset,
        @RequestParam(required = false) String handle,
        @RequestParam(required = false) String fields
    ) {
        if (handle != null && !handle.isBlank()) {
            CollectionDto one = collectionsService.getCollectionByHandle(handle.trim());
            List<CollectionDto> list = one != null ? List.of(one) : List.of();
            return ResponseEntity.ok(Map.of("collections", list));
        }
        List<CollectionDto> list = collectionsService.listCollections(limit, offset);
        return ResponseEntity.ok(Map.of("collections", list));
    }

    @GetMapping("/collections/{id}")
    public ResponseEntity<Map<String, CollectionDto>> getCollection(@PathVariable String id) {
        CollectionDto collection = collectionsService.getCollectionById(id);
        if (collection == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("collection", collection));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "collections-service"));
    }
}
