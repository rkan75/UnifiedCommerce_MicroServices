package com.tcs.commerce.regions.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * Store API region shape (Medusa compatible). Used for GET /store/regions and GET /store/regions/:id.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegionDto(
    String id,
    String name,
    String currency_code,
    Boolean automatic_taxes,
    List<CountryDto> countries,
    Map<String, Object> metadata,
    String created_at,
    String updated_at
) {}
