package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Product-level option (e.g. "Type" with values ["1 lb", "1 each"]).
 * Storefront uses this for variant selector on PDP.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductOptionDto(
    String id,
    String title,
    List<String> values
) {}
