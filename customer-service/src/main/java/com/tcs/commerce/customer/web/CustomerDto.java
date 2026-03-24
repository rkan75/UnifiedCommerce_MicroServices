package com.tcs.commerce.customer.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * Store API customer shape (Medusa compatible). GET /store/customers/me response.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CustomerDto(
    String id,
    String email,
    String first_name,
    String last_name,
    String phone,
    String company_name,
    String default_billing_address_id,
    String default_shipping_address_id,
    List<CustomerAddressDto> addresses,
    Map<String, Object> metadata,
    String created_at,
    String updated_at,
    String deleted_at
) {}
