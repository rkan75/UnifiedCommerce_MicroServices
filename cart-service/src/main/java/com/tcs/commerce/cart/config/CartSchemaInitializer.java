package com.tcs.commerce.cart.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Creates commerce_cart and related tables (unqualified names) after the application is fully started.
 * Runs as ApplicationRunner so the datasource is ready and any failure is visible at startup.
 * CartService depends on this bean so it is created before any cart operation.
 */
@Component
@Order(Integer.MIN_VALUE)
public class CartSchemaInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CartSchemaInitializer.class);

    // Tables in public schema to match CartService qualified names (public.commerce_cart, etc.)
    private static final String[] DDL = {
        "CREATE TABLE IF NOT EXISTS public.commerce_cart (id VARCHAR(64) PRIMARY KEY, region_id VARCHAR(64) NOT NULL, customer_id VARCHAR(64), email VARCHAR(255), locale VARCHAR(16), currency_code VARCHAR(8) DEFAULT 'usd', shipping_address JSONB, billing_address JSONB, metadata JSONB, shipping_methods JSONB, promo_codes JSONB, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        "CREATE TABLE IF NOT EXISTS public.commerce_line_item (id VARCHAR(64) PRIMARY KEY, cart_id VARCHAR(64) NOT NULL, variant_id VARCHAR(64) NOT NULL, product_id VARCHAR(64), title VARCHAR(512), quantity DECIMAL(20,4) NOT NULL DEFAULT 1, unit_price INTEGER, metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        "CREATE TABLE IF NOT EXISTS public.commerce_order (id VARCHAR(64) PRIMARY KEY, cart_id VARCHAR(64), region_id VARCHAR(64) NOT NULL, customer_id VARCHAR(64), email VARCHAR(255), status VARCHAR(32) DEFAULT 'pending', shipping_address JSONB, billing_address JSONB, metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        "CREATE TABLE IF NOT EXISTS public.commerce_order_line_item (id VARCHAR(64) PRIMARY KEY, order_id VARCHAR(64) NOT NULL, variant_id VARCHAR(64) NOT NULL, product_id VARCHAR(64), title VARCHAR(512), quantity DECIMAL(20,4) NOT NULL, unit_price INTEGER, metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        "CREATE INDEX IF NOT EXISTS idx_commerce_line_item_cart_id ON public.commerce_line_item(cart_id)",
        "CREATE INDEX IF NOT EXISTS idx_commerce_cart_region_id ON public.commerce_cart(region_id)",
        "CREATE INDEX IF NOT EXISTS idx_commerce_cart_customer_id ON public.commerce_cart(customer_id)",
        "CREATE INDEX IF NOT EXISTS idx_commerce_order_line_item_order_id ON public.commerce_order_line_item(order_id)",
    };

    private final JdbcTemplate jdbc;

    public CartSchemaInitializer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        runSchemaCreation();
        try {
            jdbc.queryForObject("SELECT COUNT(*) FROM public.commerce_cart", Integer.class);
            log.info("Cart schema: public.commerce_cart verified");
        } catch (Exception e) {
            log.error("Cart schema: public.commerce_cart missing or not readable. Run: cd cart-service && ./run-schema.sh (same DB as SPRING_DATASOURCE_URL)");
        }
    }

    /** Run DDL to create cart tables if missing. Idempotent (CREATE TABLE IF NOT EXISTS). Call from startup or on first request when table is missing. */
    public void runSchemaCreation() {
        for (int i = 0; i < DDL.length; i++) {
            String sql = DDL[i];
            try {
                jdbc.execute(sql);
                log.info("Cart schema: statement {} ok", i + 1);
            } catch (Exception e) {
                log.error("Cart schema: statement {} FAILED - {}. Run schema.sql manually: psql -h <host> -p <port> -U <user> -d <db> -f cart-service/src/main/resources/schema.sql. Error: {}", i + 1, sql.substring(0, Math.min(60, sql.length())) + "...", e.getMessage());
            }
        }
    }
}
