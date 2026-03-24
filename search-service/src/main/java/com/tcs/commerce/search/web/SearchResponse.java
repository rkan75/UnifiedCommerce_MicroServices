package com.tcs.commerce.search.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Response shape compatible with Medusa store GET /store/products:
 * { products: [...], count: N }
 * so the Next.js storefront can use it with minimal mapping.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SearchResponse(List<ProductDto> products, long count) {

    public static SearchResponse of(List<ProductDto> products, long count) {
        return new SearchResponse(products, count);
    }
}
