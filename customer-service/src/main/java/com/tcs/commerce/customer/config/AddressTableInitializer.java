package com.tcs.commerce.customer.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * At startup, if the address table does not exist, creates it using schema-address.sql.
 * This fixes "Create address failed" when the DB has no address table.
 */
@Component
@Order(2)
public class AddressTableInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AddressTableInitializer.class);

    private final JdbcTemplate jdbc;
    private final CustomerProperties props;

    public AddressTableInitializer(JdbcTemplate jdbc, CustomerProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getAddressTable() != null && !props.getAddressTable().isBlank()) ? props.getAddressTable().trim() : "address";
        String tableName = tbl.replaceAll("[^a-zA-Z0-9_]", "");
        try {
            Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?)",
                Boolean.class,
                schema,
                tableName
            );
            if (Boolean.TRUE.equals(exists)) {
                return;
            }
        } catch (Exception e) {
            log.warn("Could not check if address table exists: {}", e.getMessage());
            return;
        }
        log.info("Address table {}.{} does not exist. Creating it from schema-address.sql.", schema, tableName);
        try {
            ClassPathResource resource = new ClassPathResource("schema-address.sql");
            String sql = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
            List<String> statements = Arrays.stream(sql.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !s.startsWith("--"))
                .collect(Collectors.toList());
            for (String statement : statements) {
                try {
                    jdbc.execute(statement);
                    log.debug("Executed schema statement.");
                } catch (Exception e) {
                    log.warn("Schema statement failed (table may already exist): {}", e.getMessage());
                }
            }
            log.info("Address table initialization complete.");
        } catch (Exception e) {
            log.error("Failed to create address table. Run schema-address.sql manually. Error: {}", e.getMessage(), e);
        }
    }
}
