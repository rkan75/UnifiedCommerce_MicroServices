package com.tcs.commerce.products.web;

import com.tcs.commerce.products.export.ExportCriteria;
import com.tcs.commerce.products.export.ExportJobStatus;
import com.tcs.commerce.products.export.ExportRequest;
import com.tcs.commerce.products.export.ProductExportJob;
import com.tcs.commerce.products.export.ProductExportJobRegistry;
import com.tcs.commerce.products.service.ProductExportService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin/products/export")
public class AdminProductExportController {

    private final ProductExportJobRegistry jobRegistry;
    private final ProductExportService exportService;

    public AdminProductExportController(ProductExportJobRegistry jobRegistry, ProductExportService exportService) {
        this.jobRegistry = jobRegistry;
        this.exportService = exportService;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> start(@RequestBody(required = false) ExportRequest body) {
        String jobId = exportService.startExport(ExportCriteria.fromRequest(body));
        return ResponseEntity.status(HttpStatus.ACCEPTED)
            .body(Map.of("job_id", jobId, "status", "queued"));
    }

    @GetMapping(value = "/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> status(@PathVariable String jobId) {
        ProductExportJob job = jobRegistry.get(jobId);
        if (job == null) {
            return ResponseEntity.notFound().build();
        }
        String fileUrl = job.getStatus() == ExportJobStatus.COMPLETED && job.getFilePath() != null
            ? "/admin/products/export/" + jobId + "/file"
            : null;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("job_id", job.getId());
        body.put("status", job.getStatus().name().toLowerCase());
        body.put("file_url", fileUrl);
        body.put("error_message", job.getErrorMessage());
        body.put("created_at", job.getCreatedAt().toString());
        body.put("completed_at", job.getCompletedAt() != null ? job.getCompletedAt().toString() : null);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/{jobId}/file")
    public ResponseEntity<Resource> download(@PathVariable String jobId) {
        ProductExportJob job = jobRegistry.get(jobId);
        if (job == null) {
            return ResponseEntity.notFound().build();
        }
        if (job.getStatus() != ExportJobStatus.COMPLETED || job.getFilePath() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        var path = job.getFilePath();
        if (!java.nio.file.Files.isRegularFile(path)) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = new FileSystemResource(path.toFile());
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"products-export.csv\"")
            .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
            .body(resource);
    }
}
