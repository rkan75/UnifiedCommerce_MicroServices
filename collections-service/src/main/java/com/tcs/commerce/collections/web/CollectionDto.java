package com.tcs.commerce.collections.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Store API collection shape (Medusa compatible). Used for GET /store/collections and GET /store/collections/:id.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CollectionDto(
    String id,
    String title,
    String handle,
    String created_at,
    String updated_at,
    Map<String, Object> metadata
) {}
