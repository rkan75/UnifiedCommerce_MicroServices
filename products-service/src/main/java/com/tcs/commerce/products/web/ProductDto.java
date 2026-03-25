package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Medusa Store API product shape (StoreProduct).
 * Matches what the storefront expects from GET /store/products.
 * options: used by PDP variant selector (e.g. "Type" with values per variant title).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductDto(
    String id,
    String title,
    String handle,
    String description,
    String thumbnail,
    String status,
    ProductTypeDto type,
    List<ProductVariantDto> variants,
    List<ProductOptionDto> options,
    Object metadata,
    /** Used by storefront to scope collections (Shop by Brand) to storefront product type. */
    @JsonProperty("collection_id") String collectionId
) {}
