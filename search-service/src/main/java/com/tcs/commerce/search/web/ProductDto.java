package com.tcs.commerce.search.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Product shape aligned with Medusa StoreProduct for storefront compatibility.
 * Storefront may still call Medusa for full variant prices (region_id); this DTO provides enough for listing and price filter.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductDto(
    String id,
    String title,
    String handle,
    String description,
    String thumbnail,
    String status,
    List<VariantDto> variants,
    Object metadata
) {
    public static ProductDto of(String id, String title, String handle, String description, String thumbnail, String status, List<VariantDto> variants, Object metadata) {
        return new ProductDto(id, title, handle, description, thumbnail, status, variants, metadata);
    }
}
