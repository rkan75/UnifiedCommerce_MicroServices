package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Medusa GET /store/products response shape: { products: [...], count: N }.
 */
public record ProductsResponse(
    List<ProductDto> products,
    @JsonProperty("count") long count
) {
    public static ProductsResponse of(List<ProductDto> products, long count) {
        return new ProductsResponse(products, count);
    }
}
