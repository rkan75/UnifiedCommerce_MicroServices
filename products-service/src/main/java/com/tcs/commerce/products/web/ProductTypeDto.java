package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Medusa Store API product.type shape ({@code id}, {@code value}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductTypeDto(String id, String value) {}
