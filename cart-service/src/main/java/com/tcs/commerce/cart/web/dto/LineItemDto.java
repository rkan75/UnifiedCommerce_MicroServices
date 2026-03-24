package com.tcs.commerce.cart.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LineItemDto(
    String id,
    String cart_id,
    String variant_id,
    String product_id,
    String title,
    String subtitle,
    String thumbnail,
    Number quantity,
    Integer unit_price,
    Integer total,
    Map<String, Object> metadata,
    Object variant,
    Object product
) {}
