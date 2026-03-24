package com.tcs.commerce.search.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record VariantDto(
    String id,
    String title,
    String sku,
    Map<String, Object> calculated_price
) {}
