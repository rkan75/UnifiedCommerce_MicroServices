package com.tcs.commerce.cart.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CartDto(
    String id,
    String region_id,
    String customer_id,
    String email,
    String locale,
    String currency_code,
    AddressDto shipping_address,
    AddressDto billing_address,
    List<LineItemDto> items,
    Integer item_subtotal,
    Integer subtotal,
    Integer tax_total,
    Integer total,
    Integer shipping_subtotal,
    List<Object> shipping_methods,
    List<Object> promotions,
    Map<String, Object> metadata,
    String completed_at,
    Object region
) {}
