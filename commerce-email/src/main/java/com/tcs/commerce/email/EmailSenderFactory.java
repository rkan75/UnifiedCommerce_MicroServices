package com.tcs.commerce.email;

/**
 * Builds {@link EmailNotificationSender} from simple config flags so services stay vendor-neutral.
 */
public final class EmailSenderFactory {

    private EmailSenderFactory() {}

    public enum Provider {
        NOOP,
        SENDGRID
    }

    /**
     * @param enabled     master switch from configuration
     * @param providerId  e.g. {@code noop}, {@code sendgrid}
     * @param sendgridKey SendGrid API key when provider is sendgrid
     * @param fromEmail   RFC5322 from address
     * @param fromName    optional display name
     */
    public static EmailNotificationSender create(
            boolean enabled,
            String providerId,
            String sendgridKey,
            String fromEmail,
            String fromName) {
        Provider p = parseProvider(enabled, providerId);
        if (p == Provider.NOOP) {
            return new NoOpEmailNotificationSender();
        }
        if (p == Provider.SENDGRID) {
            String key = sendgridKey != null ? sendgridKey.trim() : "";
            String from = fromEmail != null ? fromEmail.trim() : "";
            if (key.isEmpty() || from.isEmpty()) {
                return new NoOpEmailNotificationSender();
            }
            return new SendGridEmailNotificationSender(key, from, fromName != null ? fromName : "");
        }
        return new NoOpEmailNotificationSender();
    }

    static Provider parseProvider(boolean enabled, String providerId) {
        if (!enabled) {
            return Provider.NOOP;
        }
        if (providerId == null || providerId.isBlank()) {
            return Provider.NOOP;
        }
        String id = providerId.trim().toLowerCase();
        if ("noop".equals(id) || "none".equals(id) || "disabled".equals(id)) {
            return Provider.NOOP;
        }
        if ("sendgrid".equals(id)) {
            return Provider.SENDGRID;
        }
        return Provider.NOOP;
    }
}
