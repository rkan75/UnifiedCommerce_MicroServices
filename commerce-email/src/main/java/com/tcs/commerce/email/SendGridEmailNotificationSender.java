package com.tcs.commerce.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;

/**
 * SendGrid Web API v3 (<a href="https://docs.sendgrid.com/api-reference/mail-send/mail-send">mail/send</a>).
 * Replace with another {@link EmailNotificationSender} implementation to change vendors.
 */
public final class SendGridEmailNotificationSender implements EmailNotificationSender {

    private static final Logger log = LoggerFactory.getLogger(SendGridEmailNotificationSender.class);
    private static final String SEND_URL = "https://api.sendgrid.com/v3/mail/send";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper json = new ObjectMapper();
    private final String apiKey;
    private final String fromEmail;
    private final String fromName;

    public SendGridEmailNotificationSender(String apiKey, String fromEmail, String fromName) {
        this.apiKey = Objects.requireNonNull(apiKey, "apiKey").trim();
        this.fromEmail = Objects.requireNonNull(fromEmail, "fromEmail").trim();
        this.fromName = fromName != null ? fromName.trim() : "";
        if (this.apiKey.isEmpty()) {
            throw new IllegalArgumentException("SendGrid API key is empty");
        }
        if (this.fromEmail.isEmpty()) {
            throw new IllegalArgumentException("from email is empty");
        }
    }

    @Override
    public boolean send(EmailMessage message) {
        try {
            ObjectNode root = json.createObjectNode();
            ArrayNode toArr = json.createArrayNode();
            for (String addr : message.getTo()) {
                ObjectNode o = json.createObjectNode();
                o.put("email", addr);
                toArr.add(o);
            }
            ObjectNode personalization = json.createObjectNode();
            personalization.set("to", toArr);
            ArrayNode pArr = json.createArrayNode();
            pArr.add(personalization);
            root.set("personalizations", pArr);

            ObjectNode from = json.createObjectNode();
            from.put("email", fromEmail);
            if (!fromName.isEmpty()) {
                from.put("name", fromName);
            }
            root.set("from", from);

            root.put("subject", message.getSubject());

            ArrayNode content = json.createArrayNode();
            ObjectNode plain = json.createObjectNode();
            plain.put("type", "text/plain");
            plain.put("value", message.getPlainText());
            content.add(plain);
            if (message.getHtml() != null && !message.getHtml().isBlank()) {
                ObjectNode html = json.createObjectNode();
                html.put("type", "text/html");
                html.put("value", message.getHtml());
                content.add(html);
            }
            root.set("content", content);

            String body = json.writeValueAsString(root);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(SEND_URL))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int code = res.statusCode();
            if (code >= 200 && code < 300) {
                log.info("SendGrid accepted email subject={} to={}", message.getSubject(), message.getTo());
                return true;
            }
            log.warn("SendGrid mail send failed status={} body={}", code, truncate(res.body(), 500));
            return false;
        } catch (Exception e) {
            log.error("SendGrid mail send error: {}", e.getMessage(), e);
            return false;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
