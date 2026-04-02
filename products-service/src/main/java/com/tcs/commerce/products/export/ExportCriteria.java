package com.tcs.commerce.products.export;

/**
 * Filter + sort snapshot for an async CSV export (aligned with GET /store/products query params).
 */
public record ExportCriteria(
    String q,
    String order,
    String typeId,
    String tag,
    String salesChannelId,
    String status,
    String createdAfter,
    String createdBefore,
    String updatedAfter,
    String updatedBefore
) {
    public static ExportCriteria fromRequest(ExportRequest req) {
        if (req == null) {
            return empty();
        }
        return new ExportCriteria(
            trimOrNull(req.q()),
            trimOrNull(req.order()),
            trimOrNull(req.typeId()),
            trimOrNull(req.tag()),
            trimOrNull(req.salesChannelId()),
            trimOrNull(req.status()),
            trimOrNull(req.createdAfter()),
            trimOrNull(req.createdBefore()),
            trimOrNull(req.updatedAfter()),
            trimOrNull(req.updatedBefore())
        );
    }

    public static ExportCriteria empty() {
        return new ExportCriteria(null, null, null, null, null, null, null, null, null, null);
    }

    private static String trimOrNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
