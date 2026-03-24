package com.tcs.commerce.cart.config;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Logs the datasource URL (password redacted) at startup so you can verify the cart service
 * uses the same database as run-schema.sh (e.g. 127.0.0.1:5433/grocery_store).
 */
@Component
@Order(Integer.MIN_VALUE + 1)
public class DataSourceLogger implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSourceLogger.class);

    private final DataSource dataSource;

    public DataSourceLogger(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (dataSource instanceof HikariDataSource hikari) {
            String url = hikari.getJdbcUrl();
            String redacted = url != null ? url.replaceAll("([?&]password=)[^&]*", "$1***") : "unknown";
            log.info("Cart service datasource: {} (ensure this matches the DB where you ran run-schema.sh)", redacted);
        }
    }
}
