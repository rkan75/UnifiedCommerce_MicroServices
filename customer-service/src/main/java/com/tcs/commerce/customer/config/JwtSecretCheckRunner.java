package com.tcs.commerce.customer.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Logs an ERROR at startup if JWT_SECRET is not set. Registration and login will fail with 503 until JWT_SECRET is set.
 */
@Component
@Order(0)
public class JwtSecretCheckRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(JwtSecretCheckRunner.class);

    private final CustomerProperties props;

    public JwtSecretCheckRunner(CustomerProperties props) {
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        String secret = props.getJwtSecret();
        if (secret == null || secret.isBlank()) {
            log.error("JWT_SECRET is not set. Customer registration and login will return 503 until you set JWT_SECRET in the environment (e.g. export JWT_SECRET=your_secret_at_least_32_chars). See customer-service/README.md.");
        }
    }
}
