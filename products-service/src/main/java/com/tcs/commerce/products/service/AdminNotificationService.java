package com.tcs.commerce.products.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * In-process notification feed for admin export (and future jobs). UI can poll GET /admin/notifications.
 * Entries are capped; not persisted across restarts.
 */
@Service
public class AdminNotificationService {

    private static final int MAX = 100;

    private final AtomicReference<List<AdminNotification>> items = new AtomicReference<>(List.of());

    public record AdminNotification(
        String id,
        String type,
        String title,
        String body,
        boolean read,
        Instant createdAt,
        Map<String, Object> data
    ) {}

    public AdminNotification publish(String type, String title, String body, Map<String, Object> data) {
        var n = new AdminNotification(UUID.randomUUID().toString(), type, title, body, false, Instant.now(), data);
        items.updateAndGet(current -> {
            var copy = new ArrayList<AdminNotification>();
            copy.add(n);
            copy.addAll(current);
            if (copy.size() > MAX) {
                return List.copyOf(copy.subList(0, MAX));
            }
            return List.copyOf(copy);
        });
        return n;
    }

    public List<AdminNotification> listRecent(int limit) {
        List<AdminNotification> current = items.get();
        int n = Math.min(Math.max(limit, 1), MAX);
        if (current.isEmpty()) {
            return List.of();
        }
        return Collections.unmodifiableList(current.subList(0, Math.min(n, current.size())));
    }

    public void publishExportReady(String jobId, String fileUrl) {
        publish(
            "product_export",
            "Export ready",
            "Your product list export finished and is ready to download.",
            Map.of("job_id", jobId, "file_url", fileUrl)
        );
    }

    public void publishExportFailed(String jobId, String error) {
        publish(
            "product_export",
            "Export failed",
            error != null && !error.isBlank() ? error : "The export could not be completed.",
            Map.of("job_id", jobId, "status", "failed")
        );
    }
}
