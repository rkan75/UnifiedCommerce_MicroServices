package com.tcs.commerce.email;

import java.util.ArrayList;
import java.util.List;

/**
 * Single transactional email (one or more recipients in "to").
 */
public final class EmailMessage {

    private final List<String> to;
    private final String subject;
    private final String plainText;
    private final String html;

    private EmailMessage(List<String> to, String subject, String plainText, String html) {
        this.to = List.copyOf(to);
        this.subject = subject != null ? subject : "";
        this.plainText = plainText != null ? plainText : "";
        this.html = html != null ? html : "";
    }

    public List<String> getTo() {
        return to;
    }

    public String getSubject() {
        return subject;
    }

    public String getPlainText() {
        return plainText;
    }

    /** May be empty if only plain text was provided. */
    public String getHtml() {
        return html;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private final List<String> to = new ArrayList<>();
        private String subject = "";
        private String plainText = "";
        private String html = "";

        public Builder to(String email) {
            if (email != null && !email.isBlank()) {
                to.add(email.trim());
            }
            return this;
        }

        public Builder subject(String s) {
            this.subject = s;
            return this;
        }

        public Builder plainText(String t) {
            this.plainText = t;
            return this;
        }

        public Builder html(String h) {
            this.html = h;
            return this;
        }

        public EmailMessage build() {
            if (to.isEmpty()) {
                throw new IllegalStateException("At least one recipient is required");
            }
            if (subject == null || subject.isBlank()) {
                throw new IllegalStateException("Subject is required");
            }
            if (plainText == null || plainText.isBlank()) {
                throw new IllegalStateException("Plain text body is required");
            }
            return new EmailMessage(to, subject, plainText, html);
        }
    }
}
