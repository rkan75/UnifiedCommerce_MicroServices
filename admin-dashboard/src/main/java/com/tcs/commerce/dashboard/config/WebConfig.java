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
        registry.addMapping("/**")
            .allowedOrigins("*")
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowCredentials(true);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
        registry.addViewController("/admin-login").setViewName("forward:/admin-login.html");
        registry.addViewController("/app").setViewName("forward:/index.html");
        registry.addViewController("/app/products").setViewName("forward:/index.html");
        registry.addViewController("/app/orders").setViewName("forward:/index.html");
        registry.addViewController("/app/regions").setViewName("forward:/index.html");
        registry.addViewController("/app/users").setViewName("forward:/index.html");
        registry.addViewController("/app/invites").setViewName("forward:/index.html");
        registry.addViewController("/app/settings").setViewName("forward:/index.html");
    }
}
