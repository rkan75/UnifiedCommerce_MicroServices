package com.tcs.commerce.customer.service;

import com.tcs.commerce.customer.config.CustomerProperties;
import com.tcs.commerce.email.EmailMessage;
import com.tcs.commerce.email.EmailNotificationSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Storefront customer transactional email (password reset, optional welcome).
 */
@Service
public class CustomerEmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(CustomerEmailNotificationService.class);

    private final EmailNotificationSender sender;
    private final CustomerProperties props;

    public CustomerEmailNotificationService(EmailNotificationSender sender, CustomerProperties props) {
        this.sender = sender;
        this.props = props;
    }

    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        if (toEmail == null || toEmail.isBlank() || resetToken == null || resetToken.isBlank()) {
            return;
        }
        String template = props.getPasswordResetUrlTemplate();
        if (template == null || !template.contains("%s")) {
            log.debug("password-reset-url-template not set or missing %s placeholder; skip email");
            return;
        }
        String url = String.format(template, resetToken);
        String plain =
                "We received a request to reset your password.\n\n"
                        + "Reset here:\n"
                        + url
                        + "\n\nIf you did not request this, ignore this email.";
        String html =
                "<p>We received a request to reset your password.</p>"
                        + "<p><a href=\""
                        + escapeHtmlAttr(url)
                        + "\">Reset password</a></p>"
                        + "<p>If you did not request this, ignore this email.</p>";
        try {
            EmailMessage msg = EmailMessage.builder()
                    .to(toEmail)
                    .subject("Password reset")
                    .plainText(plain)
                    .html(html)
                    .build();
            sender.send(msg);
        } catch (Exception e) {
            log.warn("Could not send customer password reset email: {}", e.getMessage());
        }
    }

    public void sendWelcomeEmail(String toEmail, String firstName) {
        if (!props.isWelcomeEmailEnabled() || toEmail == null || toEmail.isBlank()) {
            return;
        }
        String name = firstName != null && !firstName.isBlank() ? firstName.trim() : "there";
        String plain = "Hi " + name + ",\n\nThanks for registering. You can sign in with your email and password.\n";
        String html =
                "<p>Hi "
                        + escapeHtmlAttr(name)
                        + ",</p><p>Thanks for registering. You can sign in with your email and password.</p>";
        try {
            EmailMessage msg = EmailMessage.builder()
                    .to(toEmail)
                    .subject("Welcome")
                    .plainText(plain)
                    .html(html)
                    .build();
            sender.send(msg);
        } catch (Exception e) {
            log.warn("Could not send welcome email: {}", e.getMessage());
        }
    }

    private static String escapeHtmlAttr(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
