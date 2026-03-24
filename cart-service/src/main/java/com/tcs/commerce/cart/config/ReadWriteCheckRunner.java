package com.tcs.commerce.cart.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Verifies at startup that the DB connection allows writes (not a read replica).
 * If the check fails with SQL state 25006, logs a clear ERROR so you fix the connection before users hit "Add to cart".
 */
@Component
@Order(Integer.MIN_VALUE + 2)
public class ReadWriteCheckRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ReadWriteCheckRunner.class);

    private final JdbcTemplate jdbc;

    public ReadWriteCheckRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbc.execute("CREATE TEMP TABLE IF NOT EXISTS _cart_rw_check (id int)");
            jdbc.execute("INSERT INTO _cart_rw_check VALUES (1)");
            jdbc.execute("DROP TABLE IF EXISTS _cart_rw_check");
            log.info("Cart service: read-write check passed (DB allows INSERT)");
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("25006") || msg.contains("read-only") || msg.contains("read_only")) {
                log.error("Cart service is connected to a READ-ONLY database (replica). Add to cart will fail with 25006. " +
                    "Point SPRING_DATASOURCE_URL (and Cloud SQL Proxy INSTANCE_CONNECTION_NAME) to the PRIMARY instance, not a read replica. " +
                    "See cart-service/docs/CLOUD_SQL_READONLY_FIX.md");
            } else {
                log.warn("Cart service read-write check failed (non-fatal): {}", msg);
            }
        }
    }
}
