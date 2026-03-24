package com.tcs.commerce.cart.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tcs.commerce.cart.config.CartProperties;
import com.tcs.commerce.cart.web.dto.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Full cart implementation: create, update, line items, addShippingMethod, transferCart, complete.
 * Uses commerce_cart and commerce_line_item tables (same DB as Medusa).
 */
@Service
public class CartService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_MAP_TYPE = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final CartProperties props;
    private final com.tcs.commerce.cart.config.CartSchemaInitializer schemaInitializer;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicBoolean schemaCreationAttempted = new AtomicBoolean(false);

    public CartService(JdbcTemplate jdbc, CartProperties props, com.tcs.commerce.cart.config.CartSchemaInitializer schemaInitializer) {
        this.jdbc = jdbc;
        this.props = props;
        this.schemaInitializer = schemaInitializer;
    }

    private static boolean isMissingTableError(Throwable e) {
        String msg = e != null ? (e.getMessage() != null ? e.getMessage() : "") : "";
        return (msg.contains("commerce_cart") || msg.contains("commerce_line_item"))
            && (msg.contains("bad SQL grammar") || msg.contains("does not exist") || msg.contains("relation"));
    }

    /** Default to public schema so tables are found regardless of connection search_path. Override with app.cart.table-schema if needed. */
    private String qualifiedCartTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        return sanitize(schema) + "." + sanitize(props.getCartTable());
    }

    private String qualifiedLineItemTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        return sanitize(schema) + "." + sanitize(props.getLineItemTable());
    }

    private String qualifiedOrderTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        return sanitize(schema) + ".commerce_order";
    }

    private String qualifiedOrderLineItemTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        return sanitize(schema) + ".commerce_order_line_item";
    }

    /** Allow writes in the current transaction when the connection is read-only (e.g. Cloud SQL / replica). Must be first statement in the transaction. */
    private void setTransactionReadWrite() {
        jdbc.execute("SET LOCAL transaction_read_only = off");
    }

    /** INSERT only, in its own transaction, to avoid "JDBC commit; bad SQL grammar" when retrieve() runs after. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public String createCartInsertOnly(String regionId, String locale) {
        setTransactionReadWrite();
        String id = "cart_" + UUID.randomUUID();
        String cartTable = qualifiedCartTable();
        jdbc.update(
            "INSERT INTO " + cartTable + " (id, region_id, locale, currency_code, created_at, updated_at) VALUES (?, ?, ?, 'usd', NOW(), NOW())",
            id, regionId, locale != null && !locale.isBlank() ? locale : "en"
        );
        return id;
    }

    public CartDto create(String regionId, String locale) {
        try {
            String id = createCartInsertOnly(regionId, locale);
            return retrieve(id);
        } catch (Exception e) {
            if (isMissingTableError(e) && schemaCreationAttempted.compareAndSet(false, true)) {
                schemaInitializer.runSchemaCreation();
                String id = createCartInsertOnly(regionId, locale);
                return retrieve(id);
            }
            throw e;
        }
    }

    public CartDto retrieve(String cartId) {
        try {
            return retrieveInternal(cartId);
        } catch (Exception e) {
            if (isMissingTableError(e) && schemaCreationAttempted.compareAndSet(false, true)) {
                schemaInitializer.runSchemaCreation();
                return retrieveInternal(cartId);
            }
            throw e;
        }
    }

    /** Returns true if commerce_cart table exists and is readable (for health check). */
    public boolean isCartTableAccessible() {
        try {
            String cartTable = qualifiedCartTable();
            jdbc.queryForObject("SELECT 1 FROM " + cartTable + " LIMIT 1", Integer.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private CartDto retrieveInternal(String cartId) {
        String cartTable = qualifiedCartTable();
        String lineItemTable = qualifiedLineItemTable();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM " + cartTable + " WHERE id = ?", cartId);
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        List<Map<String, Object>> itemRows = jdbc.queryForList(
            "SELECT * FROM " + lineItemTable + " WHERE cart_id = ? ORDER BY created_at", cartId);
        return mapToCart(row, itemRows);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void updateCartOnly(String cartId, Map<String, Object> data) {
        if (data == null || data.isEmpty()) return;
        setTransactionReadWrite();
        String cartTable = qualifiedCartTable();
        List<String> setClauses = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (data.containsKey("region_id")) { setClauses.add("region_id = ?"); args.add(data.get("region_id")); }
        if (data.containsKey("customer_id")) { setClauses.add("customer_id = ?"); args.add(data.get("customer_id")); }
        if (data.containsKey("email")) { setClauses.add("email = ?"); args.add(data.get("email")); }
        if (data.containsKey("locale")) { setClauses.add("locale = ?"); args.add(data.get("locale")); }
        if (data.containsKey("shipping_address")) {
            setClauses.add("shipping_address = ?::jsonb");
            args.add(toJson(data.get("shipping_address")));
        }
        if (data.containsKey("billing_address")) {
            setClauses.add("billing_address = ?::jsonb");
            args.add(toJson(data.get("billing_address")));
        }
        if (data.containsKey("metadata")) {
            setClauses.add("metadata = ?::jsonb");
            args.add(toJson(data.get("metadata")));
        }
        if (data.containsKey("promo_codes")) {
            setClauses.add("promo_codes = ?::jsonb");
            args.add(toJson(data.get("promo_codes")));
        }
        if (setClauses.isEmpty()) return;
        setClauses.add("updated_at = NOW()");
        args.add(cartId);
        jdbc.update("UPDATE " + cartTable + " SET " + String.join(", ", setClauses) + " WHERE id = ?", args.toArray());
    }

    public CartDto update(String cartId, Map<String, Object> data) {
        if (data == null || data.isEmpty()) return retrieve(cartId);
        updateCartOnly(cartId, data);
        return retrieve(cartId);
    }

    /**
     * Prepares line item data (cart lookup, completed check, price/title/productId resolution).
     * Runs without a transaction so a failed SELECT in price resolution does not abort a shared
     * transaction and cause "25P02: current transaction is aborted" on the INSERT.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public LineItemInsertData prepareLineItemData(String cartId, String variantId, Number quantity) {
        CartDto cart = retrieve(cartId);
        if (cart == null) throw new NoSuchElementException("Cart not found: " + cartId);
        List<Map<String, Object>> completedRows = jdbc.queryForList("SELECT 1 FROM " + qualifiedCartTable() + " WHERE id = ? AND completed_at IS NOT NULL", cartId);
        if (!completedRows.isEmpty()) throw new IllegalStateException("Cart already completed");
        String regionId = cart.region_id() != null && !cart.region_id().isBlank() ? cart.region_id() : null;
        Integer unitPrice = resolveUnitPrice(variantId, regionId);
        String title = resolveVariantTitle(variantId);
        String productId = resolveProductId(variantId);
        BigDecimal qty = BigDecimal.ONE;
        if (quantity != null) {
            try {
                qty = quantity instanceof BigDecimal ? (BigDecimal) quantity : BigDecimal.valueOf(quantity.doubleValue());
            } catch (Exception ignored) { }
            if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) qty = BigDecimal.ONE;
        }
        return new LineItemInsertData(unitPrice != null ? unitPrice : 0, title != null ? title : "Item", productId != null ? productId : "", qty);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void insertLineItemOnly(String cartId, String variantId, LineItemInsertData data) {
        if (data == null) throw new IllegalArgumentException("Line item data is null");
        setTransactionReadWrite();
        String lineItemTable = qualifiedLineItemTable();
        String id = "item_" + UUID.randomUUID();
        String productId = data.productId != null ? data.productId : "";
        String title = data.title != null ? data.title : "Item";
        BigDecimal qty = data.quantity != null ? data.quantity : BigDecimal.ONE;
        int unitPrice = data.unitPrice;
        jdbc.update(
            "INSERT INTO " + lineItemTable + " (id, cart_id, variant_id, product_id, title, quantity, unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            id, cartId, variantId, productId, title, qty, unitPrice
        );
    }

    public CartDto doInsertLineItem(String cartId, String variantId, LineItemInsertData data) {
        insertLineItemOnly(cartId, variantId, data);
        return retrieve(cartId);
    }

    public CartDto createLineItem(String cartId, String variantId, Number quantity) {
        try {
            LineItemInsertData data = prepareLineItemData(cartId, variantId, quantity);
            return doInsertLineItem(cartId, variantId, data);
        } catch (NoSuchElementException | IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            String msg = e.getMessage() != null && !e.getMessage().isBlank()
                ? e.getMessage()
                : (e.getCause() != null && e.getCause().getMessage() != null ? e.getCause().getMessage() : e.getClass().getSimpleName());
            throw new IllegalStateException("Add line item failed. " + msg, e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void updateLineItemOnly(String cartId, String lineItemId, Number quantity, Map<String, Object> metadata) {
        setTransactionReadWrite();
        String lineItemTable = qualifiedLineItemTable();
        List<String> setClauses = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (quantity != null) {
            BigDecimal qty = BigDecimal.valueOf(quantity.doubleValue());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Quantity must be positive");
            setClauses.add("quantity = ?");
            args.add(qty);
        }
        if (metadata != null && !metadata.isEmpty()) {
            setClauses.add("metadata = ?::jsonb");
            args.add(toJson(metadata));
        }
        if (setClauses.isEmpty()) return;
        setClauses.add("updated_at = NOW()");
        args.add(lineItemId);
        args.add(cartId);
        int updated = jdbc.update("UPDATE " + lineItemTable + " SET " + String.join(", ", setClauses) + " WHERE id = ? AND cart_id = ?", args.toArray());
        if (updated == 0) throw new NoSuchElementException("Line item not found: " + lineItemId);
    }

    public CartDto updateLineItem(String cartId, String lineItemId, Number quantity, Map<String, Object> metadata) {
        CartDto cart = retrieve(cartId);
        if (cart == null) throw new NoSuchElementException("Cart not found: " + cartId);
        updateLineItemOnly(cartId, lineItemId, quantity, metadata);
        return retrieve(cartId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void deleteLineItem(String cartId, String lineItemId) {
        setTransactionReadWrite();
        String lineItemTable = qualifiedLineItemTable();
        int deleted = jdbc.update("DELETE FROM " + lineItemTable + " WHERE id = ? AND cart_id = ?", lineItemId, cartId);
        if (deleted == 0) throw new NoSuchElementException("Line item not found: " + lineItemId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void addShippingMethodUpdateOnly(String cartId, String optionId) {
        setTransactionReadWrite();
        String cartTable = qualifiedCartTable();
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(Map.of("id", optionId != null ? optionId : "", "option_id", optionId != null ? optionId : ""));
        jdbc.update("UPDATE " + cartTable + " SET shipping_methods = ?::jsonb, updated_at = NOW() WHERE id = ?", toJson(list), cartId);
    }

    public CartDto addShippingMethod(String cartId, String optionId) {
        addShippingMethodUpdateOnly(cartId, optionId);
        return retrieve(cartId);
    }

    public CartDto transferCart(String cartId) {
        // Transfer = associate with customer. Caller should pass customer_id via update before or after.
        return retrieve(cartId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void completeWritesOnly(String cartId, CartDto cart, String orderId) {
        setTransactionReadWrite();
        String orderTable = qualifiedOrderTable();
        String orderLineTable = qualifiedOrderLineItemTable();
        String cartTable = qualifiedCartTable();
        AddressDto ship = cart.shipping_address();
        AddressDto bill = cart.billing_address();
        String shipJson = ship != null ? toJson(Map.of(
            "first_name", ship.first_name(), "last_name", ship.last_name(), "address_1", ship.address_1(),
            "city", ship.city(), "postal_code", ship.postal_code(), "country_code", ship.country_code(), "phone", ship.phone()
        )) : "{}";
        String billJson = bill != null ? toJson(Map.of(
            "first_name", bill.first_name(), "last_name", bill.last_name(), "address_1", bill.address_1(),
            "city", bill.city(), "postal_code", bill.postal_code(), "country_code", bill.country_code(), "phone", bill.phone()
        )) : "{}";
        jdbc.update(
            "INSERT INTO " + orderTable + " (id, cart_id, region_id, customer_id, email, shipping_address, billing_address, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, NOW(), NOW())",
            orderId, cartId, cart.region_id(), cart.customer_id(), cart.email(), shipJson, billJson, cart.metadata() != null ? toJson(cart.metadata()) : "{}"
        );
        for (LineItemDto item : cart.items()) {
            String lineId = "oli_" + UUID.randomUUID();
            jdbc.update(
                "INSERT INTO " + orderLineTable + " (id, order_id, variant_id, product_id, title, quantity, unit_price, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, NOW())",
                lineId, orderId, item.variant_id(), item.product_id(), item.title(), item.quantity(), item.unit_price() != null ? item.unit_price() : 0, item.metadata() != null ? toJson(item.metadata()) : "{}"
            );
        }
        jdbc.update("UPDATE " + cartTable + " SET completed_at = NOW(), updated_at = NOW() WHERE id = ?", cartId);
    }

    public CompleteCartResponseDto complete(String cartId) {
        CartDto cart = retrieve(cartId);
        if (cart == null) throw new NoSuchElementException("Cart not found: " + cartId);
        if (cart.items() == null || cart.items().isEmpty()) throw new IllegalStateException("Cart has no items");
        String orderId = "order_" + UUID.randomUUID();
        completeWritesOnly(cartId, cart, orderId);
        OrderDto order = new OrderDto(orderId, cart.region_id(), cart.customer_id(), cart.email(), null, null, cart.metadata());
        return new CompleteCartResponseDto("order", order, cart);
    }

    /**
     * Copy cart metadata (and line-item substitution) to an order created from this cart.
     * Used by storefront after placeOrder when order was created by cart-service.
     */
    @Transactional
    public void syncCartMetadataToOrder(String orderId, String cartId) {
        CartDto cart = retrieve(cartId);
        if (cart == null) return;
        setTransactionReadWrite();
        String orderTable = qualifiedOrderTable();
        String orderLineTable = qualifiedOrderLineItemTable();
        Map<String, Object> meta = cart.metadata() != null ? new HashMap<>(cart.metadata()) : new HashMap<>();
        try {
            jdbc.update("UPDATE " + orderTable + " SET metadata = ?::jsonb, updated_at = NOW() WHERE id = ?", toJson(meta), orderId);
        } catch (Exception ignored) { }
        if (cart.items() != null && !cart.items().isEmpty()) {
            try {
                List<Map<String, Object>> orderLines = jdbc.queryForList("SELECT id, variant_id FROM " + orderLineTable + " WHERE order_id = ?", orderId);
                Map<String, Map<String, Object>> cartMetaByVariant = new HashMap<>();
                for (LineItemDto item : cart.items()) {
                    if (item.variant_id() != null && item.metadata() != null && !item.metadata().isEmpty()) {
                        cartMetaByVariant.putIfAbsent(item.variant_id(), item.metadata());
                    }
                }
                for (Map<String, Object> line : orderLines) {
                    String variantId = line.get("variant_id") != null ? line.get("variant_id").toString() : null;
                    Map<String, Object> metaToApply = variantId != null ? cartMetaByVariant.get(variantId) : null;
                    if (metaToApply != null) {
                        String lineId = line.get("id").toString();
                        jdbc.update("UPDATE " + orderLineTable + " SET metadata = ?::jsonb WHERE id = ?", toJson(metaToApply), lineId);
                    }
                }
            } catch (Exception ignored) { }
        }
    }

    /** Resolve unit price (minor units) for a variant. Tries multiple Medusa pricing schemas. */
    private Integer resolveUnitPrice(String variantId, String regionId) {
        Long amount = resolveUnitPriceAsLong(variantId, regionId);
        return amount != null ? amount.intValue() : 0;
    }

    private Long resolveUnitPriceAsLong(String variantId, String regionId) {
        if (variantId == null || variantId.isBlank()) return null;
        Long a;
        a = resolveFromPriceSetMoneyAmount(variantId);
        if (a != null) return a;
        a = resolveFromMoneyAmountTable(variantId);
        if (a != null) return a;
        a = resolveFromPriceTable(variantId);
        if (a != null) return a;
        a = resolveFromLinkTable(variantId);
        return a;
    }

    private static Long extractAmount(Object amt) {
        if (amt == null) return null;
        if (amt instanceof BigDecimal) return ((BigDecimal) amt).longValue();
        if (amt instanceof Number) return ((Number) amt).longValue();
        try {
            return Long.parseLong(amt.toString().trim());
        } catch (NumberFormatException e) {
            try {
                return (long) Double.parseDouble(amt.toString().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
    }

    private Long resolveFromPriceSetMoneyAmount(String variantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT pma.amount FROM product_variant pv " +
                    "JOIN price_set_money_amount pma ON pv.price_set_id = pma.price_set_id " +
                    "WHERE pv.id = ? AND (pma.currency_code = 'usd' OR pma.currency_code IS NULL OR LOWER(TRIM(pma.currency_code)) = 'usd') LIMIT 1",
                variantId);
            if (!rows.isEmpty()) return extractAmount(rows.get(0).get("amount"));
        } catch (Exception ignored) { }
        return null;
    }

    private Long resolveFromMoneyAmountTable(String variantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ma.amount FROM product_variant pv " +
                    "JOIN price_set_money_amount psma ON psma.price_set_id = pv.price_set_id " +
                    "JOIN money_amount ma ON ma.id = psma.money_amount_id " +
                    "WHERE pv.id = ? LIMIT 1",
                variantId);
            if (!rows.isEmpty()) return extractAmount(rows.get(0).get("amount"));
        } catch (Exception ignored) { }
        return null;
    }

    private Long resolveFromPriceTable(String variantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.amount FROM product_variant pv JOIN price p ON p.price_set_id = pv.price_set_id WHERE pv.id = ? LIMIT 1",
                variantId);
            if (!rows.isEmpty()) return extractAmount(rows.get(0).get("amount"));
        } catch (Exception ignored) { }
        return null;
    }

    private Long resolveFromLinkTable(String variantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.amount FROM product_variant_price_set link JOIN price p ON p.price_set_id = link.price_set_id WHERE link.variant_id = ? LIMIT 1",
                variantId);
            if (!rows.isEmpty()) return extractAmount(rows.get(0).get("amount"));
        } catch (Exception ignored) { }
        return null;
    }

    private String resolveVariantTitle(String variantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT title FROM product_variant WHERE id = ?", variantId);
            if (!rows.isEmpty() && rows.get(0).get("title") != null) return rows.get(0).get("title").toString();
            List<Map<String, Object>> pr = jdbc.queryForList("SELECT p.title FROM product_variant pv JOIN product p ON pv.product_id = p.id WHERE pv.id = ?", variantId);
            if (!pr.isEmpty() && pr.get(0).get("title") != null) return pr.get(0).get("title").toString();
        } catch (Exception ignored) { }
        return "Item";
    }

    private String resolveProductId(String variantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT product_id FROM product_variant WHERE id = ?", variantId);
            if (!rows.isEmpty() && rows.get(0).get("product_id") != null) return rows.get(0).get("product_id").toString();
        } catch (Exception ignored) { }
        return null;
    }

    /** Build variant object for storefront (item.variant). */
    private Map<String, Object> resolveVariantForLineItem(String variantId) {
        if (variantId == null || variantId.isBlank()) return Map.of();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, title, product_id FROM product_variant WHERE id = ? LIMIT 1", variantId);
            if (!rows.isEmpty()) {
                Map<String, Object> row = rows.get(0);
                Map<String, Object> variant = new HashMap<>();
                variant.put("id", row.get("id"));
                variant.put("title", row.get("title"));
                variant.put("product_id", row.get("product_id"));
                return variant;
            }
        } catch (Exception ignored) { }
        return Map.of("id", variantId, "title", "Item", "product_id", "");
    }

    /** Build product object for storefront (item.product with handle for links). */
    private Map<String, Object> resolveProductForLineItem(String productId) {
        if (productId == null || productId.isBlank()) return Map.of();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, title, handle, thumbnail FROM product WHERE id = ? LIMIT 1", productId);
            if (!rows.isEmpty()) {
                Map<String, Object> row = rows.get(0);
                Map<String, Object> product = new HashMap<>();
                product.put("id", row.get("id"));
                product.put("title", row.get("title"));
                product.put("handle", row.get("handle"));
                product.put("thumbnail", row.get("thumbnail"));
                return product;
            }
        } catch (Exception ignored) { }
        return Map.of("id", productId, "title", "Product", "handle", "", "thumbnail", null);
    }

    private static int safeInt(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(value.toString().trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static Number safeQuantity(Object value) {
        if (value == null) return 1;
        if (value instanceof Number n) return n;
        try {
            return BigDecimal.valueOf(Double.parseDouble(value.toString().trim()));
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    private CartDto mapToCart(Map<String, Object> row, List<Map<String, Object>> itemRows) {
        String id = getStr(row, "id");
        String regionId = getStr(row, "region_id");
        String customerId = getStr(row, "customer_id");
        String email = getStr(row, "email");
        String locale = getStr(row, "locale");
        String currencyCode = getStr(row, "currency_code");
        if (currencyCode == null) currencyCode = "usd";
        Map<String, Object> metadata = fromJson(getStr(row, "metadata"), MAP_TYPE);
        AddressDto shippingAddress = fromJsonToAddress(getStr(row, "shipping_address"));
        AddressDto billingAddress = fromJsonToAddress(getStr(row, "billing_address"));
        List<LineItemDto> items = new ArrayList<>();
        int itemSubtotal = 0;
        List<Map<String, Object>> safeItemRows = itemRows != null ? itemRows : List.of();
        for (Map<String, Object> ir : safeItemRows) {
            if (ir == null) continue;
            String itemId = getStr(ir, "id");
            String variantId = getStr(ir, "variant_id");
            String productId = getStr(ir, "product_id");
            String title = getStr(ir, "title");
            Number qty = safeQuantity(ir.get("quantity"));
            int unitPrice = safeInt(ir.get("unit_price"), 0);
            int total = unitPrice * (qty != null ? qty.intValue() : 1);
            itemSubtotal += total;
            Map<String, Object> itemMeta = fromJson(getStr(ir, "metadata"), MAP_TYPE);
            Map<String, Object> variantObj = resolveVariantForLineItem(variantId);
            Map<String, Object> productObj = resolveProductForLineItem(productId);
            items.add(new LineItemDto(
                itemId != null ? itemId : "",
                id != null ? id : "",
                variantId != null ? variantId : "",
                productId != null ? productId : "",
                title != null ? title : "Item",
                null, null, qty, unitPrice, total,
                itemMeta != null ? itemMeta : Map.of(),
                variantObj != null ? variantObj : Map.of(),
                productObj != null ? productObj : Map.of()));
        }
        List<Object> shippingMethods = fromJsonToList(getStr(row, "shipping_methods"));
        List<Object> promotions = fromJsonToList(getStr(row, "promo_codes"));
        Object completedAt = row != null ? row.get("completed_at") : null;
        String completedAtStr = completedAt != null ? completedAt.toString() : null;
        Map<String, Object> regionObj = resolveRegion(regionId);
        return new CartDto(
            id != null ? id : "",
            regionId != null ? regionId : "",
            customerId, email, locale,
            currencyCode != null ? currencyCode : "usd",
            shippingAddress, billingAddress,
            items, itemSubtotal, itemSubtotal, 0, itemSubtotal, 0,
            shippingMethods != null ? shippingMethods : List.of(),
            promotions != null ? promotions : List.of(),
            metadata != null ? metadata : Map.of(),
            completedAtStr, regionObj != null ? regionObj : Map.of());
    }

    private Map<String, Object> resolveRegion(String regionId) {
        if (regionId == null || regionId.isBlank()) return Map.of();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, currency_code FROM region WHERE id = ?", regionId);
            if (!rows.isEmpty()) {
                Map<String, Object> r = new HashMap<>(rows.get(0));
                r.put("countries", List.of());
                return r;
            }
        } catch (Exception ignored) { }
        return Map.of("id", regionId, "currency_code", "usd", "countries", List.of());
    }

    private static AddressDto fromJsonToAddress(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            Map<String, Object> m = new ObjectMapper().readValue(json, MAP_TYPE);
            return new AddressDto(
                getStr(m, "id"), getStr(m, "first_name"), getStr(m, "last_name"), getStr(m, "address_1"), getStr(m, "address_2"),
                getStr(m, "city"), getStr(m, "province"), getStr(m, "postal_code"), getStr(m, "country_code"), getStr(m, "phone"), getStr(m, "company")
            );
        } catch (Exception e) {
            return null;
        }
    }

    private static String getStr(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : null;
    }

    private <T> T fromJson(String json, TypeReference<T> type) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Object> fromJsonToList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return (List<Object>) (List<?>) objectMapper.readValue(json, LIST_MAP_TYPE);
        } catch (Exception e) {
            return List.of();
        }
    }

    private String toJson(Object o) {
        if (o == null) return "{}";
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) return "commerce_cart";
        return name.replaceAll("[^a-zA-Z0-9_]", "");
    }

    /** Holder for line item fields resolved in read phase (no transaction) before INSERT. */
    private static final class LineItemInsertData {
        final int unitPrice;
        final String title;
        final String productId;
        final BigDecimal quantity;

        LineItemInsertData(int unitPrice, String title, String productId, BigDecimal quantity) {
            this.unitPrice = unitPrice;
            this.title = title;
            this.productId = productId;
            this.quantity = quantity;
        }
    }
}
