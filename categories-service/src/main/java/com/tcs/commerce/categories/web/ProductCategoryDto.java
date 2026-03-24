package com.tcs.commerce.categories.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * Store API product category shape (Medusa compatible).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductCategoryDto(
    String id,
    String name,
    String handle,
    String description,
    String parent_category_id,
    ProductCategoryDto parent_category,
    List<ProductCategoryDto> category_children,
    Integer rank,
    Boolean is_active,
    Map<String, Object> metadata,
    String created_at,
    String updated_at
) {}
