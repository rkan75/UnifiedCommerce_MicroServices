package com.tcs.commerce.customer.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * At startup, verifies the customer_auth table exists. If not, logs ERROR with instructions.
 * Without this table, registration creates the customer but login always fails with "Invalid email or password".
 */
@Component
@Order(1)
public class AuthTableCheckRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AuthTableCheckRunner.class);

    private final JdbcTemplate jdbc;
    private final CustomerProperties props;

    public AuthTableCheckRunner(JdbcTemplate jdbc, CustomerProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        String schema = (props.getTableSchema() != null && !props.getTableSchema().isBlank()) ? props.getTableSchema().trim() : "public";
        String tbl = (props.getAuthTable() != null && !props.getAuthTable().isBlank()) ? props.getAuthTable().trim() : "customer_auth";
        String tableName = tbl.replaceAll("[^a-zA-Z0-9_]", "");
        try {
            Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?)",
                Boolean.class,
                schema,
                tableName
            );
            if (Boolean.FALSE.equals(exists)) {
                log.error(
                    "Table {}.{} does not exist. Registration will create customers but login will always fail with 'Invalid email or password'. Create it by running: psql -h HOST -p PORT -U USER -d DB -f customer-service/src/main/resources/schema-auth.sql",
                    schema,
                    tableName
                );
            }
        } catch (Exception e) {
            log.error(
                "Could not verify auth table {}.{}. Registration/login may fail. Create customer_auth with: psql ... -f customer-service/src/main/resources/schema-auth.sql  Error: {}",
                schema,
                tableName,
                e.getMessage()
            );
        }
    }
}
