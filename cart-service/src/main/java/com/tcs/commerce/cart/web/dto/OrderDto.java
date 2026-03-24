package com.tcs.commerce.cart.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderDto(
    String id,
    String region_id,
    String customer_id,
    String email,
    Object shipping_address,
    Object billing_address,
    Map<String, Object> metadata
) {}
