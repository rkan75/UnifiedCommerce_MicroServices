package com.tcs.commerce.products.service;

import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.export.ExportCriteria;
import com.tcs.commerce.products.export.ExportJobStatus;
import com.tcs.commerce.products.export.ProductExportJob;
import com.tcs.commerce.products.export.ProductExportJobRegistry;
import com.tcs.commerce.products.web.ProductDto;
import com.tcs.commerce.products.web.ProductsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class ProductExportService {

    private static final Logger log = LoggerFactory.getLogger(ProductExportService.class);

    private final ProductExportJobRegistry jobRegistry;
    private final ProductsService productsService;
    private final ProductsProperties props;
    private final AdminNotificationService notifications;
    private final ThreadPoolTaskExecutor exportTaskExecutor;

    public ProductExportService(
        ProductExportJobRegistry jobRegistry,
        ProductsService productsService,
        ProductsProperties props,
        AdminNotificationService notifications,
        @Qualifier("exportTaskExecutor") ThreadPoolTaskExecutor exportTaskExecutor
    ) {
        this.jobRegistry = jobRegistry;
        this.productsService = productsService;
        this.props = props;
        this.notifications = notifications;
        this.exportTaskExecutor = exportTaskExecutor;
    }

    public String startExport(ExportCriteria criteria) {
        ExportCriteria c = criteria != null ? criteria : ExportCriteria.empty();
        ProductExportJob job = jobRegistry.enqueue(c);
        String jobId = job.getId();
        exportTaskExecutor.execute(() -> runExport(jobId));
        return jobId;
    }

    private void runExport(String jobId) {
        ProductExportJob job = jobRegistry.get(jobId);
        if (job == null) {
            return;
        }
        job.setStatus(ExportJobStatus.RUNNING);
        Path tempFile = null;
        try {
            tempFile = Files.createTempFile("products-export-" + jobId + "-", ".csv");
            try (BufferedWriter w = Files.newBufferedWriter(tempFile, StandardCharsets.UTF_8)) {
                w.write("title,handle,id,status,variant_count");
                w.newLine();
                writeAllRows(w, job.getCriteria());
            }
            job.setFilePath(tempFile);
            job.setStatus(ExportJobStatus.COMPLETED);
            job.setCompletedAt(java.time.Instant.now());
            String fileUrl = "/admin/products/export/" + jobId + "/file";
            notifications.publishExportReady(jobId, fileUrl);
        } catch (Exception e) {
            log.warn("[product-export] job {} failed", jobId, e);
            job.setStatus(ExportJobStatus.FAILED);
            job.setCompletedAt(java.time.Instant.now());
            job.setErrorMessage(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (IOException ignored) {}
            }
            job.setFilePath(null);
            notifications.publishExportFailed(jobId, job.getErrorMessage());
        }
    }

    private void writeAllRows(BufferedWriter w, ExportCriteria c) throws IOException {
        int limit = Math.max(1, props.getMaxLimit());
        long offset = 0;
        Long total = null;
        while (true) {
            String exportTypeId = c.typeId();
            boolean skipDefaultType = exportTypeId == null || exportTypeId.isBlank();
            ProductsResponse resp = productsService.getProducts(
                null,
                null,
                c.q(),
                null,
                null,
                null,
                null,
                exportTypeId,
                limit,
                (int) offset,
                c.status(),
                c.tag(),
                c.salesChannelId(),
                c.createdAfter(),
                c.createdBefore(),
                c.updatedAfter(),
                c.updatedBefore(),
                c.order(),
                skipDefaultType
            );
            if (total == null) {
                total = resp.count();
            }
            for (ProductDto p : resp.products()) {
                writeCsvRow(w, p);
            }
            if (resp.products().isEmpty()) {
                break;
            }
            offset += resp.products().size();
            if (offset >= total) {
                break;
            }
        }
    }

    private static void writeCsvRow(BufferedWriter w, ProductDto p) throws IOException {
        int vc = p.variants() == null ? 0 : p.variants().size();
        writeField(w, p.title());
        w.write(',');
        writeField(w, p.handle());
        w.write(',');
        writeField(w, p.id());
        w.write(',');
        writeField(w, p.status());
        w.write(',');
        w.write(Integer.toString(vc));
        w.newLine();
    }

    private static void writeField(BufferedWriter w, String s) throws IOException {
        if (s == null) {
            return;
        }
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
            w.write('"');
            w.write(s.replace("\"", "\"\""));
            w.write('"');
        } else {
            w.write(s);
        }
    }
}
