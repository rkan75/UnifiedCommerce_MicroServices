package com.tcs.commerce.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * No mail is sent; logs at DEBUG. Use when {@code app.email.enabled=false} or provider is noop.
 */
public final class NoOpEmailNotificationSender implements EmailNotificationSender {

    private static final Logger log = LoggerFactory.getLogger(NoOpEmailNotificationSender.class);

    @Override
    public boolean send(EmailMessage message) {
        log.debug("Email skipped (noop): to={} subject={}", message.getTo(), message.getSubject());
        return true;
    }
}
