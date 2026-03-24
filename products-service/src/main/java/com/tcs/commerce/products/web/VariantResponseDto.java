package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Single variant response for GET /store/product-variants/:id.
 * Includes product_id for storefront wishlist and backend order weight-detail.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record VariantResponseDto(
    String id,
    String product_id,
    String title,
    String sku,
    CalculatedPriceDto calculated_price,
    Object metadata
) {}
