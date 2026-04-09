package com.tcs.commerce.customer.config;

import com.tcs.commerce.email.EmailNotificationSender;
import com.tcs.commerce.email.EmailSenderFactory;
import com.tcs.commerce.email.NoOpEmailNotificationSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmailConfiguration {

    private static final Logger log = LoggerFactory.getLogger(EmailConfiguration.class);

    @Bean
    public EmailNotificationSender emailNotificationSender(EmailProperties emailProperties) {
        EmailNotificationSender sender = EmailSenderFactory.create(
                emailProperties.isEnabled(),
                emailProperties.getProvider(),
                emailProperties.getSendgrid().getApiKey(),
                emailProperties.getFromAddress(),
                emailProperties.getFromName());
        if (emailProperties.isEnabled()
                && "sendgrid".equalsIgnoreCase(String.valueOf(emailProperties.getProvider()).trim())) {
            if (sender instanceof NoOpEmailNotificationSender) {
                log.warn(
                        "Email: provider is sendgrid but API key or from-address is empty — no mail will be sent. "
                                + "Set SENDGRID_API_KEY or use application-local.yml in the working directory (see spring.config.import).");
            } else {
                log.info(
                        "Email: SendGrid active (from: \"{}\" <{}>)",
                        emailProperties.getFromName(),
                        emailProperties.getFromAddress());
            }
        }
        return sender;
    }
}
