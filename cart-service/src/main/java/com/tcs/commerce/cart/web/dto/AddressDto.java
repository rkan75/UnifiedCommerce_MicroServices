package com.tcs.commerce.cart.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AddressDto(
    String id,
    String first_name,
    String last_name,
    String address_1,
    String address_2,
    String city,
    String province,
    String postal_code,
    String country_code,
    String phone,
    String company
) {}
