package com.tcs.commerce.search.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.search")
public class SearchProperties {

    /** Medusa product table name (e.g. product or custom) */
    private String productTable = "product";
    /** Medusa product_variant table name */
    private String variantTable = "product_variant";
    /** Link table (product_id, product_category_id). Used in lowercase in SQL. */
    private String productCategoryLinkTable = "product_category_product";
    /** Category column in link table (product_category_id or category_id) */
    private String productCategoryLinkTableCategoryColumn = "product_category_id";
    private int maxLimit = 100;
    private int defaultLimit = 12;

    public String getProductTable() {
        return productTable;
    }

    public void setProductTable(String productTable) {
        this.productTable = productTable;
    }

    public String getVariantTable() {
        return variantTable;
    }

    public void setVariantTable(String variantTable) {
        this.variantTable = variantTable;
    }

    public String getProductCategoryLinkTable() {
        return productCategoryLinkTable;
    }

    public void setProductCategoryLinkTable(String productCategoryLinkTable) {
        this.productCategoryLinkTable = productCategoryLinkTable;
    }

    public String getProductCategoryLinkTableCategoryColumn() {
        return productCategoryLinkTableCategoryColumn;
    }

    public void setProductCategoryLinkTableCategoryColumn(String productCategoryLinkTableCategoryColumn) {
        this.productCategoryLinkTableCategoryColumn = productCategoryLinkTableCategoryColumn;
    }

    public int getMaxLimit() {
        return maxLimit;
    }

    public void setMaxLimit(int maxLimit) {
        this.maxLimit = maxLimit;
    }

    public int getDefaultLimit() {
        return defaultLimit;
    }

    public void setDefaultLimit(int defaultLimit) {
        this.defaultLimit = defaultLimit;
    }
}
