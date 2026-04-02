package com.tcs.commerce.products.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.products")
public class ProductsProperties {

    private String productTable = "product";
    private String variantTable = "product_variant";
    /** Catalog {@code product_option} (title per product). */
    private String productOptionTable = "product_option";
    /** {@code product_option_value} ({@code option_id}, {@code value}). */
    private String productOptionValueTable = "product_option_value";
    /** Pivot {@code product_variant_option} ({@code variant_id}, {@code option_value_id}). */
    private String productVariantOptionTable = "product_variant_option";
    private String regionTable = "region";
    private String productCategoryTable = "product_category";
    /** Link table name (e.g. product_category_product). Columns: product_id, product_category_id. Used in lowercase in SQL. */
    private String productCategoryLinkTable = "product_category_product";
    /** Category column name in the link table (product_category_id or category_id) */
    private String productCategoryLinkTableCategoryColumn = "product_category_id";
    /** {@code product_type} table; join for {@code type} on products. Set empty to disable join. */
    private String productTypeTable = "product_type";
    /**
     * When non-blank (env {@code CATALOG_DEFAULT_PRODUCT_TYPE_ID}), catalog reads without an explicit {@code type_id}
     * are scoped to this {@code product.type_id}; explicit {@code type_id} on the request overrides.
     */
    private String defaultProductTypeId = "";
    private int maxLimit = 100;
    private int defaultLimit = 12;
    /** When set (e.g. product_sales_channel), filters by sales_channel_id via EXISTS on this link table. */
    private String productSalesChannelLinkTable = "";
    /** {@code sales_channel} table for GET /store/sales-channels (admin filter list). */
    private String salesChannelTable = "sales_channel";
    /** Medusa {@code store} row for admin store settings. */
    private String storeTable = "store";
    /**
     * Medusa v2 {@code store_currency} (per-store supported currencies; {@code is_default} marks default).
     * After migration {@code Migration20240621145944}, {@code store.default_currency_code} is removed.
     */
    private String storeCurrencyTable = "store_currency";
    /** {@code stock_location} for default location picker. */
    private String stockLocationTable = "stock_location";
    /** {@code currency} master (optional); when missing, currencies are derived from regions. */
    private String currencyTable = "currency";
    /**
     * Default pivot {@code product_tags} ({@code product_id}, {@code product_tag_id}). Set empty to disable relational tags.
     */
    private String productTagLinkTable = "product_tags";
    /** Tag master table (default {@code product_tag}). */
    private String productTagTable = "product_tag";
    private String productTagIdColumn = "id";
    private String productTagValueColumn = "value";
    private String productTagLinkProductColumn = "product_id";
    private String productTagLinkTagColumn = "product_tag_id";

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

    public String getProductOptionTable() {
        return productOptionTable;
    }

    public void setProductOptionTable(String productOptionTable) {
        this.productOptionTable = productOptionTable != null && !productOptionTable.isBlank() ? productOptionTable : "product_option";
    }

    public String getProductOptionValueTable() {
        return productOptionValueTable;
    }

    public void setProductOptionValueTable(String productOptionValueTable) {
        this.productOptionValueTable =
            productOptionValueTable != null && !productOptionValueTable.isBlank() ? productOptionValueTable : "product_option_value";
    }

    public String getProductVariantOptionTable() {
        return productVariantOptionTable;
    }

    public void setProductVariantOptionTable(String productVariantOptionTable) {
        this.productVariantOptionTable =
            productVariantOptionTable != null && !productVariantOptionTable.isBlank() ? productVariantOptionTable : "product_variant_option";
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

    public String getDefaultProductTypeId() {
        return defaultProductTypeId;
    }

    public void setDefaultProductTypeId(String defaultProductTypeId) {
        this.defaultProductTypeId = defaultProductTypeId != null ? defaultProductTypeId : "";
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

    public String getProductSalesChannelLinkTable() {
        return productSalesChannelLinkTable;
    }

    public void setProductSalesChannelLinkTable(String productSalesChannelLinkTable) {
        this.productSalesChannelLinkTable = productSalesChannelLinkTable != null ? productSalesChannelLinkTable : "";
    }

    public String getSalesChannelTable() {
        return salesChannelTable;
    }

    public void setSalesChannelTable(String salesChannelTable) {
        this.salesChannelTable = salesChannelTable != null ? salesChannelTable : "sales_channel";
    }

    public String getStoreTable() {
        return storeTable;
    }

    public void setStoreTable(String storeTable) {
        this.storeTable = storeTable != null && !storeTable.isBlank() ? storeTable : "store";
    }

    public String getStoreCurrencyTable() {
        return storeCurrencyTable;
    }

    public void setStoreCurrencyTable(String storeCurrencyTable) {
        this.storeCurrencyTable =
            storeCurrencyTable != null && !storeCurrencyTable.isBlank() ? storeCurrencyTable : "store_currency";
    }

    public String getStockLocationTable() {
        return stockLocationTable;
    }

    public void setStockLocationTable(String stockLocationTable) {
        this.stockLocationTable = stockLocationTable != null && !stockLocationTable.isBlank() ? stockLocationTable : "stock_location";
    }

    public String getCurrencyTable() {
        return currencyTable;
    }

    public void setCurrencyTable(String currencyTable) {
        this.currencyTable = currencyTable != null && !currencyTable.isBlank() ? currencyTable : "currency";
    }

    public String getProductTagLinkTable() {
        return productTagLinkTable;
    }

    public void setProductTagLinkTable(String productTagLinkTable) {
        this.productTagLinkTable = productTagLinkTable != null ? productTagLinkTable.trim() : "";
    }

    public String getProductTagTable() {
        return productTagTable;
    }

    public void setProductTagTable(String productTagTable) {
        this.productTagTable = productTagTable != null && !productTagTable.isBlank() ? productTagTable : "product_tag";
    }

    public String getProductTagIdColumn() {
        return productTagIdColumn;
    }

    public void setProductTagIdColumn(String productTagIdColumn) {
        this.productTagIdColumn = productTagIdColumn != null && !productTagIdColumn.isBlank() ? productTagIdColumn : "id";
    }

    public String getProductTagValueColumn() {
        return productTagValueColumn;
    }

    public void setProductTagValueColumn(String productTagValueColumn) {
        this.productTagValueColumn = productTagValueColumn != null && !productTagValueColumn.isBlank() ? productTagValueColumn : "value";
    }

    public String getProductTagLinkProductColumn() {
        return productTagLinkProductColumn;
    }

    public void setProductTagLinkProductColumn(String productTagLinkProductColumn) {
        this.productTagLinkProductColumn =
            productTagLinkProductColumn != null && !productTagLinkProductColumn.isBlank() ? productTagLinkProductColumn : "product_id";
    }

    public String getProductTagLinkTagColumn() {
        return productTagLinkTagColumn;
    }

    public void setProductTagLinkTagColumn(String productTagLinkTagColumn) {
        this.productTagLinkTagColumn =
            productTagLinkTagColumn != null && !productTagLinkTagColumn.isBlank() ? productTagLinkTagColumn : "product_tag_id";
    }
}
