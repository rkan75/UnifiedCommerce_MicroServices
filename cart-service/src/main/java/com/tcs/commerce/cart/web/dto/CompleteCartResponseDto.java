package com.tcs.commerce.cart.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CompleteCartResponseDto(
    String type,
    OrderDto order,
    CartDto cart
) {}
