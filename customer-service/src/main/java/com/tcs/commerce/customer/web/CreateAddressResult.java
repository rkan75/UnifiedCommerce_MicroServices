package com.tcs.commerce.customer.web;

import java.util.Optional;

/** Result of create address: success with DTO or failure with error message. */
public final class CreateAddressResult {

    private final CustomerAddressDto address;
    private final String errorMessage;

    private CreateAddressResult(CustomerAddressDto address, String errorMessage) {
        this.address = address;
        this.errorMessage = errorMessage;
    }

    public static CreateAddressResult ok(CustomerAddressDto address) {
        return new CreateAddressResult(address, null);
    }

    public static CreateAddressResult fail(String errorMessage) {
        return new CreateAddressResult(null, errorMessage);
    }

    public Optional<CustomerAddressDto> getAddress() {
        return Optional.ofNullable(address);
    }

    public Optional<String> getErrorMessage() {
        return Optional.ofNullable(errorMessage);
    }
}
