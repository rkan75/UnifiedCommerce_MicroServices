package com.tcs.commerce.dashboard.config;

import com.tcs.commerce.dashboard.filter.AuthFilter;
import com.tcs.commerce.dashboard.security.JwtValidator;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<AuthFilter> authFilter(DashboardProperties props, JwtValidator jwtValidator) {
        FilterRegistrationBean<AuthFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new AuthFilter(props, jwtValidator));
        bean.addUrlPatterns("/app/*", "/admin/*");
        bean.setOrder(1);
        return bean;
    }
}
