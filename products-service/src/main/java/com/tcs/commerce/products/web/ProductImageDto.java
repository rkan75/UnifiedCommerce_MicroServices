package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Medusa-compatible product image entry ({@code images: [{url}]}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductImageDto(String url) {}
