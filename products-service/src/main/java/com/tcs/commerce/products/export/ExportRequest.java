package com.tcs.commerce.products.export;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * JSON body for POST /admin/products/export (snake_case fields for admin UI).
 */
public record ExportRequest(
    String q,
    String order,
    @JsonProperty("type_id") String typeId,
    String tag,
    @JsonProperty("sales_channel_id") String salesChannelId,
    String status,
    @JsonProperty("created_after") String createdAfter,
    @JsonProperty("created_before") String createdBefore,
    @JsonProperty("updated_after") String updatedAfter,
    @JsonProperty("updated_before") String updatedBefore
) {}
