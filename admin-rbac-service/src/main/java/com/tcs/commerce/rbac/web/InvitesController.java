package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.service.RbacService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Admin invites API (Medusa-compatible): list, create.
 */
@RestController
@RequestMapping("/admin/invites")
public class InvitesController {

    private final RbacService rbacService;

    public InvitesController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "10") int limit) {
        List<InviteDto> invites = rbacService.listInvites(offset, limit);
        return ResponseEntity.ok(Map.of(
                "invites", invites,
                "count", invites.size(),
                "offset", offset,
                "limit", limit));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        String email = body != null && body.containsKey("email") ? String.valueOf(body.get("email")).trim() : null;
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required to send an invite."));
        }
        Optional<InviteDto> created = rbacService.createInvite(email);
        if (created.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("message", "An invite for this email already exists or the user is already registered."));
        }
        return ResponseEntity.ok(Map.of("invite", created.get()));
    }
}
