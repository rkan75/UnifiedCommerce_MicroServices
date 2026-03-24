package com.tcs.commerce.rbac.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Logs an error at startup if ADMIN_JWT_SECRET (or JWT_SECRET) is not set,
 * so admin login does not fail with a generic "Invalid email or password" when JWT generation fails.
 */
@Component
@Order(1)
public class AdminJwtSecretCheckRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminJwtSecretCheckRunner.class);

    private final AdminAuthProperties props;

    public AdminJwtSecretCheckRunner(AdminAuthProperties props) {
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank()) {
            log.error("ADMIN_JWT_SECRET (or JWT_SECRET) is not set. Admin login will fail at JWT generation. Set it in .env or environment (e.g. same value as store backend JWT_SECRET).");
        } else if (secret.length() < 32) {
            log.warn("ADMIN_JWT_SECRET is shorter than 32 characters. JWT signing may require at least 256 bits (32 chars). Consider: openssl rand -hex 32");
        }
    }
}
