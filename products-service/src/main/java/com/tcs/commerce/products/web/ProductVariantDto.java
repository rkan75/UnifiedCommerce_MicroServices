package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Medusa StoreProduct.variants[] shape for storefront compatibility.
 * options: used by PDP to match selected variant; manage_inventory/allow_backorder/inventory_quantity for stock badge.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductVariantDto(
    String id,
    String title,
    String sku,
    CalculatedPriceDto calculated_price,
    List<VariantOptionDto> options,
    Boolean manage_inventory,
    Boolean allow_backorder,
    Integer inventory_quantity,
    Object metadata
) {
    public ProductVariantDto(String id, String title, String sku, CalculatedPriceDto calculated_price) {
        this(id, title, sku, calculated_price, null, false, false, null, null);
    }
}
