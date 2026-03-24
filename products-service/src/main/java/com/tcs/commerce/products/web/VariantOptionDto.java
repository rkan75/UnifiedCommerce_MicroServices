package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Variant-level option value (option_id + value). Used to match selected variant on PDP.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record VariantOptionDto(
    String option_id,
    String value
) {}
