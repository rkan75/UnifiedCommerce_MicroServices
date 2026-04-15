package com.tcs.commerce.regions.web;

import com.tcs.commerce.regions.service.RegionsService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Store API regions: GET /store/regions and GET /store/regions/:id (Medusa replacement).
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class RegionsController {

    private final RegionsService regionsService;

    public RegionsController(RegionsService regionsService) {
        this.regionsService = regionsService;
    }

    @GetMapping("/regions")
    public ResponseEntity<Map<String, List<RegionDto>>> listRegions() {
        List<RegionDto> regions = regionsService.listRegions();
        return ResponseEntity.ok(Map.of("regions", regions));
    }

    @GetMapping("/regions/{id}")
    public ResponseEntity<Map<String, RegionDto>> getRegion(@PathVariable String id) {
        RegionDto region = regionsService.getRegionById(id);
        if (region == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("region", region));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "regions-service"));
    }
}
