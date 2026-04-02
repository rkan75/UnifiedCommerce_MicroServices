package com.tcs.commerce.products.export;

import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ProductExportJobRegistry {

    private final ConcurrentHashMap<String, ProductExportJob> jobs = new ConcurrentHashMap<>();

    public ProductExportJob enqueue(ExportCriteria criteria) {
        String id = UUID.randomUUID().toString();
        ProductExportJob job = new ProductExportJob(id, criteria);
        jobs.put(id, job);
        return job;
    }

    public ProductExportJob get(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        return jobs.get(id.trim());
    }
}
