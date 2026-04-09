package com.tcs.commerce.rbac.service;

import com.tcs.commerce.email.EmailMessage;
import com.tcs.commerce.email.EmailNotificationSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sends admin-facing transactional emails (invite, password reset).
 */
@Service
public class AuthEmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(AuthEmailNotificationService.class);

    private final EmailNotificationSender sender;

    public AuthEmailNotificationService(EmailNotificationSender sender) {
        this.sender = sender;
    }

    public void sendInviteEmail(String toEmail, String registrationUrl) {
        if (toEmail == null || toEmail.isBlank() || registrationUrl == null || registrationUrl.isBlank()) {
            return;
        }
        String plain =
                "You have been invited to the admin console.\n\n"
                        + "Complete your registration here:\n"
                        + registrationUrl
                        + "\n\nIf you did not expect this message, you can ignore it.";
        String html =
                "<p>You have been invited to the admin console.</p>"
                        + "<p><a href=\""
                        + escapeHtmlAttr(registrationUrl)
                        + "\">Complete your registration</a></p>"
                        + "<p>If you did not expect this message, you can ignore it.</p>";
        try {
            EmailMessage msg = EmailMessage.builder()
                    .to(toEmail)
                    .subject("Admin invitation")
                    .plainText(plain)
                    .html(html)
                    .build();
            sender.send(msg);
        } catch (Exception e) {
            log.warn("Could not build/send invite email: {}", e.getMessage());
        }
    }

    public void sendPasswordResetEmail(String toEmail, String resetUrl) {
        if (toEmail == null || toEmail.isBlank() || resetUrl == null || resetUrl.isBlank()) {
            return;
        }
        String plain =
                "We received a request to reset your admin password.\n\n"
                        + "Reset your password here:\n"
                        + resetUrl
                        + "\n\nIf you did not request this, you can ignore this email.";
        String html =
                "<p>We received a request to reset your admin password.</p>"
                        + "<p><a href=\""
                        + escapeHtmlAttr(resetUrl)
                        + "\">Reset your password</a></p>"
                        + "<p>If you did not request this, you can ignore this email.</p>";
        try {
            EmailMessage msg = EmailMessage.builder()
                    .to(toEmail)
                    .subject("Password reset")
                    .plainText(plain)
                    .html(html)
                    .build();
            sender.send(msg);
        } catch (Exception e) {
            log.warn("Could not build/send password reset email: {}", e.getMessage());
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
