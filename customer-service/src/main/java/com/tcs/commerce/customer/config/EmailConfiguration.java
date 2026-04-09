package com.tcs.commerce.customer.config;

import com.tcs.commerce.email.EmailNotificationSender;
import com.tcs.commerce.email.EmailSenderFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmailConfiguration {

    @Bean
    public EmailNotificationSender emailNotificationSender(EmailProperties emailProperties) {
        return EmailSenderFactory.create(
                emailProperties.isEnabled(),
                emailProperties.getProvider(),
                emailProperties.getSendgrid().getApiKey(),
                emailProperties.getFromAddress(),
                emailProperties.getFromName());
    }
}
