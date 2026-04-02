package com.tcs.commerce.dashboard.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient webClient(WebClient.Builder builder) {
        // Catalog proxies (e.g. GET /store/products) can exceed the default 256KB when thumbnails are embedded.
        return builder
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(32 * 1024 * 1024))
            .build();
    }
}
