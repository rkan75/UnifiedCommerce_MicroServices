package com.tcs.commerce.products.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Medusa Store API calculated_price shape (variant price in minor unit).
 * Mirrors Medusa Pricing Module calculatePrices response so storefront shows price and sale badge.
 * - calculated_amount: amount shown to customer
 * - original_amount: base price (for "Save X%" when sale)
 * - currency_code: from region or price
 * - price_list_type: e.g. "sale" when from a price list
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CalculatedPriceDto(
    Long calculated_amount,
    String currency_code,
    Long original_amount,
    String price_list_type
) {
    public CalculatedPriceDto(Long calculated_amount, String currency_code) {
        this(calculated_amount, currency_code, calculated_amount, null);
    }
}
