package com.tcs.commerce.cart.web;

import com.tcs.commerce.cart.service.CartService;
import com.tcs.commerce.cart.web.dto.CartDto;
import com.tcs.commerce.cart.web.dto.CompleteCartResponseDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Store Cart API: create, update, line items, addShippingMethod, complete, transfer.
 * Replaces sdk.store.cart.* usage when CART_SERVICE_URL is set.
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    private static Number parseQuantity(Object q) {
        if (q instanceof Number) return (Number) q;
        if (q == null) return 1;
        try {
            String s = q.toString().trim();
            if (s.isEmpty()) return 1;
            if (s.contains(".")) return Double.parseDouble(s);
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        boolean cartTableOk = cartService.isCartTableAccessible();
        Map<String, String> body = Map.of(
            "status", "UP",
            "service", "cart-service",
            "cart_table_ok", String.valueOf(cartTableOk)
        );
        if (!cartTableOk) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
        }
        return ResponseEntity.ok(body);
    }

    @GetMapping("/carts/{id}")
    public ResponseEntity<Map<String, CartDto>> getCart(@PathVariable String id, @RequestParam(required = false) String fields) {
        CartDto cart = cartService.retrieve(id);
        if (cart == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("cart", cart));
    }

    @PostMapping("/carts")
    public ResponseEntity<Map<String, CartDto>> createCart(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().build();
        }
        Object regionIdObj = body.get("region_id");
        String regionId = regionIdObj != null ? regionIdObj.toString().trim() : "";
        if (regionId.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Object localeObj = body.get("locale");
        String locale = localeObj != null ? localeObj.toString().trim() : null;
        if (locale != null && locale.isEmpty()) locale = null;
        CartDto cart = cartService.create(regionId, locale);
        return ResponseEntity.ok(Map.of("cart", cart));
    }

    @RequestMapping(value = "/carts/{id}", method = { RequestMethod.POST, RequestMethod.PATCH, RequestMethod.PUT })
    public ResponseEntity<Map<String, CartDto>> updateCart(@PathVariable String id, @RequestBody Map<String, Object> body) {
        try {
            CartDto cart = cartService.update(id, body != null ? body : Collections.emptyMap());
            return ResponseEntity.ok(Map.of("cart", cart));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/carts/{id}/line-items")
    public ResponseEntity<?> createLineItem(
        @PathVariable String id,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        if (body == null) {
            return ResponseEntity.badRequest().build();
        }
        Object variantIdObj = body.get("variant_id");
        String variantId = variantIdObj != null ? variantIdObj.toString().trim() : "";
        if (variantId.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Number quantity = parseQuantity(body.get("quantity"));
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = body.get("metadata") instanceof Map ? (Map<String, Object>) body.get("metadata") : null;
        try {
            CartDto cart = cartService.createLineItem(id, variantId, quantity, metadata);
            return ResponseEntity.ok(Map.of("cart", cart));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Cart not found"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Invalid request"));
        } catch (IllegalStateException e) {
            String msg = e.getMessage() != null && !e.getMessage().isBlank() ? e.getMessage() : "Cannot add line item";
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("message", msg));
        }
    }

    @RequestMapping(value = "/carts/{cartId}/line-items/{lineId}", method = { RequestMethod.POST, RequestMethod.PATCH, RequestMethod.PUT })
    public ResponseEntity<Map<String, CartDto>> updateLineItem(
        @PathVariable String cartId,
        @PathVariable String lineId,
        @RequestBody Map<String, Object> body
    ) {
        Number quantity = body != null && body.get("quantity") instanceof Number ? (Number) body.get("quantity") : null;
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = body != null && body.get("metadata") instanceof Map ? (Map<String, Object>) body.get("metadata") : null;
        try {
            CartDto cart = cartService.updateLineItem(cartId, lineId, quantity, metadata);
            return ResponseEntity.ok(Map.of("cart", cart));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/carts/{cartId}/line-items/{lineId}")
    public ResponseEntity<Void> deleteLineItem(@PathVariable String cartId, @PathVariable String lineId) {
        try {
            cartService.deleteLineItem(cartId, lineId);
            return ResponseEntity.ok().build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/carts/{cartId}/line_items/{lineId}")
    public ResponseEntity<Void> deleteLineItemSnake(@PathVariable String cartId, @PathVariable String lineId) {
        return deleteLineItem(cartId, lineId);
    }

    @PostMapping("/carts/{id}/shipping-methods")
    public ResponseEntity<Map<String, CartDto>> addShippingMethod(
        @PathVariable String id,
        @RequestBody Map<String, Object> body
    ) {
        String optionId = (String) (body != null ? body.get("option_id") : null);
        try {
            CartDto cart = cartService.addShippingMethod(id, optionId);
            return ResponseEntity.ok(Map.of("cart", cart));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/carts/{id}/complete")
    public ResponseEntity<CompleteCartResponseDto> completeCart(@PathVariable String id) {
        try {
            CompleteCartResponseDto result = cartService.complete(id);
            return ResponseEntity.ok(result);
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.unprocessableEntity().build();
        }
    }

    @PostMapping("/carts/{id}/transfer")
    public ResponseEntity<Map<String, CartDto>> transferCart(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        if (body != null && body.containsKey("customer_id")) {
            CartDto cart = cartService.update(id, Map.of("customer_id", body.get("customer_id")));
            return ResponseEntity.ok(Map.of("cart", cart));
        }
        CartDto cart = cartService.transferCart(id);
        return ResponseEntity.ok(Map.of("cart", cart));
    }

    @PostMapping("/carts/{id}/promotions")
    public ResponseEntity<Map<String, CartDto>> addPromotions(@PathVariable String id, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        java.util.List<String> codes = body != null && body.get("promo_codes") instanceof java.util.List
            ? (java.util.List<String>) body.get("promo_codes") : Collections.emptyList();
        try {
            CartDto cart = cartService.update(id, Map.of("promo_codes", codes));
            return ResponseEntity.ok(Map.of("cart", cart));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/carts/{id}/promotions")
    public ResponseEntity<Map<String, CartDto>> removePromotions(@PathVariable String id, @RequestBody Map<String, Object> body) {
        try {
            CartDto cart = cartService.update(id, Map.of("promo_codes", Collections.emptyList()));
            return ResponseEntity.ok(Map.of("cart", cart));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/orders/{orderId}/sync-cart-metadata")
    public ResponseEntity<Map<String, String>> syncCartMetadata(
        @PathVariable String orderId,
        @RequestBody Map<String, Object> body
    ) {
        String cartId = body != null ? (String) body.get("cart_id") : null;
        if (cartId == null || cartId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "cart_id is required"));
        }
        try {
            cartService.syncCartMetadataToOrder(orderId, cartId);
            return ResponseEntity.ok(Map.of("success", "true"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }
}
