package com.tcs.commerce.products.export;

import java.nio.file.Path;
import java.time.Instant;

public final class ProductExportJob {

    private final String id;
    private final ExportCriteria criteria;
    private final Instant createdAt;
    private volatile ExportJobStatus status;
    private volatile Instant completedAt;
    private volatile String errorMessage;
    private volatile Path filePath;

    public ProductExportJob(String id, ExportCriteria criteria) {
        this.id = id;
        this.criteria = criteria;
        this.createdAt = Instant.now();
        this.status = ExportJobStatus.QUEUED;
    }

    public String getId() {
        return id;
    }

    public ExportCriteria getCriteria() {
        return criteria;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public ExportJobStatus getStatus() {
        return status;
    }

    public void setStatus(ExportJobStatus status) {
        this.status = status;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Path getFilePath() {
        return filePath;
    }

    public void setFilePath(Path filePath) {
        this.filePath = filePath;
    }
}
