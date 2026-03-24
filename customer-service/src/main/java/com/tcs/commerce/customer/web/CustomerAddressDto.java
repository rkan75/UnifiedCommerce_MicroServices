package com.tcs.commerce.customer.web;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Store API customer address shape (Medusa compatible).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CustomerAddressDto(
    String id,
    String customer_id,
    String first_name,
    String last_name,
    String company,
    String address_1,
    String address_2,
    String city,
    String province,
    String postal_code,
    String country_code,
    String phone,
    Boolean is_default_billing,
    Boolean is_default_shipping,
    Object metadata,
    String created_at,
    String updated_at
) {}
