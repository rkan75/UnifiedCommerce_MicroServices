package com.tcs.commerce.customer.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.stereotype.Component;

/**
 * Ensures the Hikari pool is explicitly set to read-write so connections are not
 * treated as read-only (fixes SQL state 25006 "cannot execute INSERT in a read-only transaction"
 * when the DB or proxy hands out read-only connections, e.g. Cloud SQL read replica).
 */
@Component
public class HikariReadWriteConfig implements BeanPostProcessor {

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof HikariDataSource hikari) {
            hikari.setReadOnly(false);
        }
        return bean;
    }
}
