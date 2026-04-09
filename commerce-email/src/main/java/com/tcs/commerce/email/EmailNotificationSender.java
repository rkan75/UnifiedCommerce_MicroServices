package com.tcs.commerce.email;

/**
 * Pluggable transactional email delivery. Implementations may use SendGrid, SES, SMTP, etc.
 */
@FunctionalInterface
public interface EmailNotificationSender {

    /**
     * @return true if the provider accepted the message (e.g. HTTP 202 from SendGrid)
     */
    boolean send(EmailMessage message);
}
