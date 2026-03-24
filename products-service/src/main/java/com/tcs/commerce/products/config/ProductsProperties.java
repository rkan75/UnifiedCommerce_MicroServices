package com.tcs.commerce.products.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.products")
public class ProductsProperties {

    private String productTable = "product";
    private String variantTable = "product_variant";
    private String regionTable = "region";
    private String productCategoryTable = "product_category";
    /** Link table name (e.g. product_category_product). Columns: product_id, product_category_id. Used in lowercase in SQL. */
    private String productCategoryLinkTable = "product_category_product";
    /** Category column name in the link table (product_category_id or category_id) */
    private String productCategoryLinkTableCategoryColumn = "product_category_id";
    /** Medusa {@code product_type} table; join for {@code type} on products. Set empty to disable join. */
    private String productTypeTable = "product_type";
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

    public String getRegionTable() {
        return regionTable;
    }

    public void setRegionTable(String regionTable) {
        this.regionTable = regionTable;
    }

    public String getProductCategoryTable() {
        return productCategoryTable;
    }

    public void setProductCategoryTable(String productCategoryTable) {
        this.productCategoryTable = productCategoryTable;
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

    public String getProductTypeTable() {
        return productTypeTable;
    }

    public void setProductTypeTable(String productTypeTable) {
        this.productTypeTable = productTypeTable;
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
