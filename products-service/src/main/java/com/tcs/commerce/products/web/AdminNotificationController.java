package com.tcs.commerce.products.web;

import com.tcs.commerce.products.service.AdminNotificationService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(value = "/admin/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminNotificationController {

    private final AdminNotificationService notifications;

    public AdminNotificationController(AdminNotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(name = "limit", defaultValue = "50") int limit) {
        List<Map<String, Object>> rows = notifications.listRecent(limit).stream()
            .map(this::toJson)
            .toList();
        return Map.of("notifications", rows);
    }

    private Map<String, Object> toJson(AdminNotificationService.AdminNotification n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.id());
        m.put("type", n.type());
        m.put("title", n.title());
        m.put("body", n.body());
        m.put("read", n.read());
        m.put("created_at", n.createdAt().toString());
        m.put("data", n.data());
        return m;
    }
}
