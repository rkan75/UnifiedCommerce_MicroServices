package com.tcs.commerce.customer.service;

import com.tcs.commerce.customer.config.CustomerProperties;
import com.tcs.commerce.customer.web.CreateAddressResult;
import com.tcs.commerce.customer.web.CustomerAddressDto;
import com.tcs.commerce.customer.web.CustomerDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Reads customer and addresses from the same Medusa DB. GET /store/customers/me and CRUD.
 */
@Service
public class CustomerService {

    private static final Logger log = LoggerFactory.getLogger(CustomerService.class);
    private final JdbcTemplate jdbc;
    private final CustomerProperties props;

    private static String getStr(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        if (v == null) return "";
        return v.toString().trim();
    }

    private static boolean getBool(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        if (v == Boolean.TRUE) return true;
        if (v instanceof String s) return "true".equalsIgnoreCase(s.trim());
        return false;
    }

    public CustomerService(JdbcTemplate jdbc, CustomerProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    private String customerTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getCustomerTable() != null && !props.getCustomerTable().isBlank()) ? props.getCustomerTable().trim() : "customer";
        return schema + "." + tbl.replaceAll("[^a-zA-Z0-9_]", "");
    }

    private String addressTable() {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getAddressTable() != null && !props.getAddressTable().isBlank()) ? props.getAddressTable().trim() : "address";
        return schema + "." + tbl.replaceAll("[^a-zA-Z0-9_]", "");
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /** Get customer by id with addresses. Returns null if not found. */
    public CustomerDto getCustomerById(String customerId) {
        if (customerId == null || customerId.isBlank()) return null;
        String cTbl = customerTable();
        String aTbl = addressTable();
        try {
            String sql = "SELECT id, email, first_name, last_name, phone, company_name, default_billing_address_id, default_shipping_address_id, metadata, created_at, updated_at, deleted_at FROM " + cTbl + " WHERE id = ? AND (deleted_at IS NULL OR deleted_at > NOW()) LIMIT 1";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, customerId.trim());
            if (rows.isEmpty()) return null;
            Map<String, Object> row = rows.get(0);
            List<CustomerAddressDto> addresses = getAddressesForCustomer(customerId.trim(), aTbl);
            return mapToCustomer(row, addresses);
        } catch (Exception e) {
            try {
                String sql = "SELECT id, email, first_name, last_name, phone, metadata, created_at, updated_at FROM " + cTbl + " WHERE id = ? LIMIT 1";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, customerId.trim());
                if (rows.isEmpty()) return null;
                List<CustomerAddressDto> addresses = getAddressesForCustomer(customerId.trim(), aTbl);
                return mapToCustomer(rows.get(0), addresses);
            } catch (Exception e2) {
                return null;
            }
        }
    }

    private List<CustomerAddressDto> getAddressesForCustomer(String customerId, String aTbl) {
        List<CustomerAddressDto> list = new ArrayList<>();
        try {
            String sql = "SELECT id, customer_id, first_name, last_name, company, address_1, address_2, city, province, postal_code, country_code, phone, metadata, created_at, updated_at FROM " + aTbl + " WHERE customer_id = ? ORDER BY created_at";
            List<Map<String, Object>> rows = jdbc.queryForList(sql, customerId);
            for (Map<String, Object> r : rows) {
                list.add(mapToAddress(r, customerId));
            }
        } catch (Exception e) {
            try {
                String sql = "SELECT id, customer_id, first_name, last_name, address_1, address_2, city, province, postal_code, country_code, phone FROM " + aTbl + " WHERE customer_id = ?";
                List<Map<String, Object>> rows = jdbc.queryForList(sql, customerId);
                for (Map<String, Object> r : rows) {
                    list.add(mapToAddress(r, customerId));
                }
            } catch (Exception ignored) {
            }
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private CustomerDto mapToCustomer(Map<String, Object> row, List<CustomerAddressDto> addresses) {
        String id = str(row.get("id"));
        if (id == null) return null;
        String email = str(row.get("email"));
        String firstName = str(row.get("first_name"));
        String lastName = str(row.get("last_name"));
        String phone = str(row.get("phone"));
        String companyName = str(row.get("company_name"));
        String defaultBillingId = str(row.get("default_billing_address_id"));
        String defaultShippingId = str(row.get("default_shipping_address_id"));
        String createdAt = row.get("created_at") != null ? row.get("created_at").toString() : null;
        String updatedAt = row.get("updated_at") != null ? row.get("updated_at").toString() : null;
        String deletedAt = row.get("deleted_at") != null ? row.get("deleted_at").toString() : null;
        Map<String, Object> metadata = row.get("metadata") instanceof Map ? (Map<String, Object>) row.get("metadata") : null;
        return new CustomerDto(id, email, firstName, lastName, phone, companyName, defaultBillingId, defaultShippingId, addresses.isEmpty() ? null : addresses, metadata, createdAt, updatedAt, deletedAt);
    }

    @SuppressWarnings("unchecked")
    private CustomerAddressDto mapToAddress(Map<String, Object> row, String customerId) {
        String id = str(row.get("id"));
        String firstName = str(row.get("first_name"));
        String lastName = str(row.get("last_name"));
        String company = str(row.get("company"));
        String address1 = str(row.get("address_1"));
        String address2 = str(row.get("address_2"));
        String city = str(row.get("city"));
        String province = str(row.get("province"));
        String postalCode = str(row.get("postal_code"));
        String countryCode = str(row.get("country_code"));
        String phone = str(row.get("phone"));
        Boolean defaultBilling = row.get("is_default_billing") instanceof Boolean b ? b : null;
        Boolean defaultShipping = row.get("is_default_shipping") instanceof Boolean s ? s : null;
        String createdAt = row.get("created_at") != null ? row.get("created_at").toString() : null;
        String updatedAt = row.get("updated_at") != null ? row.get("updated_at").toString() : null;
        Object metadata = row.get("metadata");
        return new CustomerAddressDto(id, customerId, firstName, lastName, company, address1, address2, city, province, postalCode, countryCode, phone, defaultBilling, defaultShipping, metadata, createdAt, updatedAt);
    }

    /** Update customer profile. Returns updated customer or null. */
    public CustomerDto updateCustomer(String customerId, Map<String, Object> body) {
        if (customerId == null || customerId.isBlank() || body == null || body.isEmpty()) return null;
        String cTbl = customerTable();
        try {
            List<String> sets = new ArrayList<>();
            List<Object> params = new ArrayList<>();
            if (body.containsKey("first_name")) { sets.add("first_name = ?"); params.add(body.get("first_name")); }
            if (body.containsKey("last_name")) { sets.add("last_name = ?"); params.add(body.get("last_name")); }
            if (body.containsKey("phone")) { sets.add("phone = ?"); params.add(body.get("phone")); }
            if (body.containsKey("company_name")) { sets.add("company_name = ?"); params.add(body.get("company_name")); }
            if (body.containsKey("metadata")) { sets.add("metadata = ?"); params.add(body.get("metadata")); }
            if (sets.isEmpty()) return getCustomerById(customerId);
            sets.add("updated_at = NOW()");
            params.add(customerId);
            String sql = "UPDATE " + cTbl + " SET " + String.join(", ", sets) + " WHERE id = ?";
            jdbc.update(sql, params.toArray());
            return getCustomerById(customerId);
        } catch (Exception e) {
            return null;
        }
    }

    /** Create address for customer. Returns result with created address or error message. Tries multiple INSERT variants for schema compatibility. */
    public CreateAddressResult createAddress(String customerId, Map<String, Object> body) {
        if (customerId == null || customerId.isBlank() || body == null) {
            return CreateAddressResult.fail("Missing customer or address data");
        }
        String aTbl = addressTable();
        String id = "addr_" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String fn = getStr(body, "first_name");
        String ln = getStr(body, "last_name");
        String company = getStr(body, "company");
        String addr1 = getStr(body, "address_1");
        String addr2 = getStr(body, "address_2");
        String city = getStr(body, "city");
        String province = getStr(body, "province");
        String postalCode = getStr(body, "postal_code");
        String countryCode = getStr(body, "country_code");
        String phone = getStr(body, "phone");
        boolean defaultBilling = getBool(body, "is_default_billing");
        boolean defaultShipping = getBool(body, "is_default_shipping");
        if (addr1.isEmpty() || city.isEmpty() || postalCode.isEmpty() || countryCode.isEmpty()) {
            log.warn("Create address missing required fields: address_1, city, postal_code, or country_code");
            return CreateAddressResult.fail("Missing required fields: address, city, postal code, or country");
        }
        String lastError = null;
        try {
            jdbc.update(
                "INSERT INTO " + aTbl + " (id, customer_id, first_name, last_name, company, address_1, address_2, city, province, postal_code, country_code, phone, is_default_billing, is_default_shipping, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
                id, customerId, fn, ln, company.isEmpty() ? null : company, addr1, addr2.isEmpty() ? null : addr2, city, province.isEmpty() ? null : province, postalCode, countryCode, phone.isEmpty() ? null : phone, defaultBilling, defaultShipping
            );
            CustomerAddressDto created = selectAndMapAddress(aTbl, id, customerId);
            if (created != null) return CreateAddressResult.ok(created);
        } catch (Exception e) {
            lastError = e.getMessage();
            log.debug("Create address full INSERT failed: {}", lastError);
        }
        try {
            jdbc.update(
                "INSERT INTO " + aTbl + " (id, customer_id, first_name, last_name, address_1, address_2, city, province, postal_code, country_code, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
                id, customerId, fn, ln, addr1, addr2.isEmpty() ? null : addr2, city, province.isEmpty() ? null : province, postalCode, countryCode, phone.isEmpty() ? null : phone
            );
            CustomerAddressDto created = selectAndMapAddress(aTbl, id, customerId);
            if (created != null) return CreateAddressResult.ok(created);
        } catch (Exception e) {
            lastError = e.getMessage();
            log.debug("Create address INSERT without company/booleans failed: {}", lastError);
        }
        try {
            jdbc.update(
                "INSERT INTO " + aTbl + " (id, customer_id, first_name, last_name, address_1, city, postal_code, country_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
                id, customerId, fn, ln, addr1, city, postalCode, countryCode
            );
            CustomerAddressDto created = selectAndMapAddress(aTbl, id, customerId);
            if (created != null) return CreateAddressResult.ok(created);
        } catch (Exception e) {
            lastError = e.getMessage();
            log.error("Create address failed for table {}. Error: {}", aTbl, lastError, e);
        }
        return CreateAddressResult.fail(lastError != null ? lastError : "Address table may not exist. Restart customer-service to auto-create it, or run schema-address.sql.");
    }

    private CustomerAddressDto selectAndMapAddress(String aTbl, String id, String customerId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM " + aTbl + " WHERE id = ?", id);
            return rows.isEmpty() ? null : mapToAddress(rows.get(0), customerId);
        } catch (Exception e) {
            log.warn("Address created but SELECT failed: {}", e.getMessage());
            return null;
        }
    }

    /** Update address. Returns updated address or null. */
    public CustomerAddressDto updateAddress(String customerId, String addressId, Map<String, Object> body) {
        if (customerId == null || addressId == null || body == null || body.isEmpty()) return null;
        String aTbl = addressTable();
        try {
            List<String> sets = new ArrayList<>();
            List<Object> params = new ArrayList<>();
            if (body.containsKey("first_name")) { sets.add("first_name = ?"); params.add(body.get("first_name")); }
            if (body.containsKey("last_name")) { sets.add("last_name = ?"); params.add(body.get("last_name")); }
            if (body.containsKey("company")) { sets.add("company = ?"); params.add(body.get("company")); }
            if (body.containsKey("address_1")) { sets.add("address_1 = ?"); params.add(body.get("address_1")); }
            if (body.containsKey("address_2")) { sets.add("address_2 = ?"); params.add(body.get("address_2")); }
            if (body.containsKey("city")) { sets.add("city = ?"); params.add(body.get("city")); }
            if (body.containsKey("province")) { sets.add("province = ?"); params.add(body.get("province")); }
            if (body.containsKey("postal_code")) { sets.add("postal_code = ?"); params.add(body.get("postal_code")); }
            if (body.containsKey("country_code")) { sets.add("country_code = ?"); params.add(body.get("country_code")); }
            if (body.containsKey("phone")) { sets.add("phone = ?"); params.add(body.get("phone")); }
            if (sets.isEmpty()) return null;
            sets.add("updated_at = NOW()");
            params.add(addressId);
            params.add(customerId);
            jdbc.update("UPDATE " + aTbl + " SET " + String.join(", ", sets) + " WHERE id = ? AND customer_id = ?", params.toArray());
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM " + aTbl + " WHERE id = ? AND customer_id = ?", addressId, customerId);
            return rows.isEmpty() ? null : mapToAddress(rows.get(0), customerId);
        } catch (Exception e) {
            return null;
        }
    }

    /** Delete address. Returns true if deleted. */
    public boolean deleteAddress(String customerId, String addressId) {
        if (customerId == null || addressId == null) return false;
        String aTbl = addressTable();
        try {
            int n = jdbc.update("DELETE FROM " + aTbl + " WHERE id = ? AND customer_id = ?", addressId, customerId);
            return n > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
