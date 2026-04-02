package com.tcs.commerce.dashboard.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // allowedOrigins("*") + allowCredentials(true) is invalid in Spring 5.3+ and causes HTTP 500
        registry.addMapping("/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
        registry.addViewController("/admin-login").setViewName("forward:/admin-login.html");
        registry.addViewController("/app").setViewName("forward:/index.html");
        registry.addViewController("/app/products").setViewName("forward:/index.html");
        registry.addViewController("/app/product-categories").setViewName("forward:/index.html");
        registry.addViewController("/app/product-collections").setViewName("forward:/index.html");
        registry.addViewController("/app/orders").setViewName("forward:/index.html");
        registry.addViewController("/app/orders/drafts").setViewName("forward:/index.html");
        registry.addViewController("/app/inventory").setViewName("forward:/index.html");
        registry.addViewController("/app/customers").setViewName("forward:/index.html");
        registry.addViewController("/app/promotions").setViewName("forward:/index.html");
        registry.addViewController("/app/price-lists").setViewName("forward:/index.html");
        registry.addViewController("/app/regions").setViewName("forward:/index.html");
        registry.addViewController("/app/users").setViewName("forward:/index.html");
        registry.addViewController("/app/invites").setViewName("forward:/index.html");
        registry.addViewController("/app/recipes").setViewName("forward:/index.html");
        registry.addViewController("/app/price-update").setViewName("forward:/index.html");
        registry.addViewController("/app/search").setViewName("forward:/index.html");
        registry.addViewController("/app/settings").setViewName("forward:/index.html");
    }
}
