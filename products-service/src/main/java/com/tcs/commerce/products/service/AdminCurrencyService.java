package com.tcs.commerce.products.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.tcs.commerce.products.config.ProductsProperties;
import com.tcs.commerce.products.persistence.CatalogSchemaCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.UUID;

/**
 * Admin currency updates: tax-inclusive flag on {@code currency}, remove link from {@code store_currency}.
 */
@Service
public class AdminCurrencyService {

    private static final Logger log = LoggerFactory.getLogger(AdminCurrencyService.class);

    private final JdbcTemplate jdbc;
    private final ProductsProperties props;
    private final CatalogSchemaCache schema;
    private final AdminStoreService adminStoreService;

    public AdminCurrencyService(
        JdbcTemplate jdbc,
        ProductsProperties props,
        CatalogSchemaCache schema,
        AdminStoreService adminStoreService
    ) {
        this.jdbc = jdbc;
        this.props = props;
        this.schema = schema;
        this.adminStoreService = adminStoreService;
    }

    public void patchTaxInclusive(String code, JsonNode body) {
        if (code == null || code.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "currency code required");
        }
        if (body == null || body.isNull() || !body.has("tax_inclusive_pricing")) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "tax_inclusive_pricing boolean required");
        }
        boolean value = body.get("tax_inclusive_pricing").asBoolean(false);
        String codeNorm = code.trim().toLowerCase(Locale.ROOT);
        String cTable = sanitizeTable(props.getCurrencyTable());
        if (!schema.hasTable(cTable) || !schema.hasColumn(cTable, "code")) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "Currency table not available");
        }
        String taxCol = resolveCurrencyTaxColumn(cTable);
        boolean ppOk = canUpsertPricePreference();
        if (taxCol == null && !ppOk) {
            throw new ProductWriteException(
                HttpStatus.BAD_REQUEST,
                "No tax column on currency and price_preference table missing; cannot update tax-inclusive flag"
            );
        }
        if (taxCol != null) {
            String alive = schema.hasColumn(cTable, "deleted_at") ? "deleted_at IS NULL" : "TRUE";
            StringBuilder upd = new StringBuilder("UPDATE ").append(cTable).append(" SET ").append(taxCol).append(" = ?");
            if (schema.hasColumn(cTable, "updated_at")) {
                upd.append(", updated_at = NOW()");
            }
            upd.append(" WHERE lower(code::text) = lower(?) AND ").append(alive);
            int n;
            try {
                n = jdbc.update(upd.toString(), value, codeNorm);
            } catch (Exception e) {
                log.warn("[admin-currency] patch tax (currency table): {}", e.getMessage());
                throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not update currency: " + e.getMessage());
            }
            if (n != 1) {
                throw new ProductWriteException(HttpStatus.NOT_FOUND, "Currency not found: " + codeNorm);
            }
        }
        if (ppOk) {
            upsertPricePreferenceTaxInclusive(codeNorm, value);
        }
    }

    /**
     * Medusa v2 aligns with {@link com.tcs.commerce.products.service.AdminStoreService} reads: tax-inclusive for a
     * store currency is stored in {@code price_preference} ({@code attribute=currency_code}).
     */
    private boolean canUpsertPricePreference() {
        String pp = "price_preference";
        return schema.hasTable(pp)
            && schema.hasColumn(pp, "id")
            && schema.hasColumn(pp, "attribute")
            && schema.hasColumn(pp, "value")
            && schema.hasColumn(pp, "is_tax_inclusive");
    }

    private void upsertPricePreferenceTaxInclusive(String currencyCodeLower, boolean taxInclusive) {
        String pp = "price_preference";
        try {
            StringBuilder upd =
                new StringBuilder("UPDATE ")
                    .append(pp)
                    .append(" SET is_tax_inclusive = ?, updated_at = NOW()");
            if (schema.hasColumn(pp, "deleted_at")) {
                upd.append(", deleted_at = NULL");
            }
            upd.append(" WHERE attribute = 'currency_code' AND lower(trim(value::text)) = lower(?)");
            int n = jdbc.update(upd.toString(), taxInclusive, currencyCodeLower);
            if (n >= 1) {
                return;
            }
            String newId = "ppref_" + UUID.randomUUID().toString().replace("-", "");
            jdbc.update(
                "INSERT INTO "
                    + pp
                    + " (id, attribute, value, is_tax_inclusive, created_at, updated_at) VALUES (?, 'currency_code', ?, ?, NOW(), NOW())",
                newId,
                currencyCodeLower,
                taxInclusive
            );
        } catch (Exception e) {
            log.warn("[admin-currency] upsert price_preference: {}", e.getMessage());
            throw new ProductWriteException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Could not update price preference: " + e.getMessage()
            );
        }
    }

    public void removeStoreCurrencyLink(String code) {
        if (code == null || code.isBlank()) {
            throw new ProductWriteException(HttpStatus.BAD_REQUEST, "currency code required");
        }
        String storeId = adminStoreService.getDefaultStoreId();
        if (storeId == null || storeId.isBlank()) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "No store id available");
        }
        String scTable = sanitizeTable(props.getStoreCurrencyTable());
        if (!schema.hasTable(scTable)
            || !schema.hasColumn(scTable, "store_id")
            || !schema.hasColumn(scTable, "currency_code")) {
            throw new ProductWriteException(HttpStatus.NOT_FOUND, "store_currency table not available");
        }
        try {
            if (schema.hasColumn(scTable, "deleted_at")) {
                StringBuilder soft = new StringBuilder("UPDATE ").append(scTable).append(" SET deleted_at = NOW()");
                if (schema.hasColumn(scTable, "updated_at")) {
                    soft.append(", updated_at = NOW()");
                }
                soft.append(" WHERE store_id::text = ? AND lower(trim(currency_code::text)) = lower(trim(?)) AND deleted_at IS NULL");
                int n = jdbc.update(soft.toString(), storeId.trim(), code.trim());
                if (n != 1) {
                    throw new ProductWriteException(HttpStatus.NOT_FOUND, "Store currency link not found");
                }
            } else {
                int n = jdbc.update(
                    "DELETE FROM "
                        + scTable
                        + " WHERE store_id::text = ? AND lower(trim(currency_code::text)) = lower(trim(?))",
                    storeId.trim(),
                    code.trim()
                );
                if (n != 1) {
                    throw new ProductWriteException(HttpStatus.NOT_FOUND, "Store currency link not found");
                }
            }
        } catch (ProductWriteException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[admin-currency] remove link: {}", e.getMessage());
            throw new ProductWriteException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not remove currency: " + e.getMessage());
        }
    }

    private static String sanitizeTable(String name) {
        if (name == null || name.isBlank()) {
            return "currency";
        }
        return name.replaceAll("[^a-zA-Z0-9_]", "").toLowerCase(Locale.ROOT);
    }

    private String resolveCurrencyTaxColumn(String cTable) {
        if (!schema.hasTable(cTable)) {
            return null;
        }
        if (schema.hasColumn(cTable, "tax_inclusive_pricing")) {
            return "tax_inclusive_pricing";
        }
        if (schema.hasColumn(cTable, "includes_tax")) {
            return "includes_tax";
        }
        return null;
    }
}
