package com.tcs.commerce.cart.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.cart")
public class CartProperties {

    private String cartTable = "commerce_cart";
    private String lineItemTable = "commerce_line_item";
    /** Schema for table qualification (e.g. "public"). Empty = unqualified names (use DB search_path). */
    private String tableSchema = "";

    public String getCartTable() {
        return cartTable;
    }

    public void setCartTable(String cartTable) {
        this.cartTable = cartTable;
    }

    public String getLineItemTable() {
        return lineItemTable;
    }

    public void setLineItemTable(String lineItemTable) {
        this.lineItemTable = lineItemTable;
    }

    public String getTableSchema() {
        return tableSchema;
    }

    public void setTableSchema(String tableSchema) {
        this.tableSchema = tableSchema;
    }
}
