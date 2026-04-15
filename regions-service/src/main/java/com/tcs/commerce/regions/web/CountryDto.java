package com.tcs.commerce.regions.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Store API country shape (Medusa compatible).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CountryDto(
    String iso_2,
    String iso_3,
    String name,
    String display_name,
    String num_code
) {}
