package com.tcs.commerce.search.web;

import com.tcs.commerce.search.service.AdminSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin/search")
public class AdminSearchController {

    private final AdminSearchService adminSearchService;

    public AdminSearchController(AdminSearchService adminSearchService) {
        this.adminSearchService = adminSearchService;
    }

    @GetMapping
    public ResponseEntity<AdminSearchResponse> search(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String types,
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) Integer offset,
        @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return ResponseEntity.ok(adminSearchService.search(q, types, limit, offset, authorization));
    }

    @GetMapping("/meta")
    public ResponseEntity<Map<String, Object>> meta() {
        return ResponseEntity.ok(Map.of(
            "supported_types", adminSearchService.supportedTypes(),
            "usage", "GET /admin/search?q=milk&types=products,categories,orders&limit=10&offset=0"
        ));
    }
}
