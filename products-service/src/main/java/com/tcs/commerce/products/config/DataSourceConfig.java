package com.tcs.commerce.products.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.stereotype.Component;

/**
 * Appends prepareThreshold=0 to the JDBC URL to avoid PostgreSQL error:
 * "bind message supplies 1 parameters, but prepared statement requires 2"
 * when the connection pool reuses connections with different prepared statements.
 */
@Component
public class DataSourceConfig implements BeanPostProcessor {

    private static final String PARAM = "prepareThreshold=0";

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof HikariDataSource hikari) {
            String url = hikari.getJdbcUrl();
            if (url != null && !url.contains("prepareThreshold=")) {
                String separator = url.contains("?") ? "&" : "?";
                hikari.setJdbcUrl(url + separator + PARAM);
            }
        }
        return bean;
    }
}
