package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.service.RbacService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Admin users API (Medusa-compatible): list, get, update, delete, set roles.
 */
@RestController
@RequestMapping("/admin/users")
public class UsersController {

    private final RbacService rbacService;

    public UsersController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public ResponseEntity<Map<String, List<UserDto>>> list(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "500") int limit) {
        return ResponseEntity.ok(Map.of("users", rbacService.listUsers(offset, limit)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, UserDto>> get(@PathVariable String id) {
        return rbacService.getUser(id)
                .map(u -> ResponseEntity.ok(Map.of("user", u)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String email = body != null && body.containsKey("email") ? String.valueOf(body.get("email")).trim() : null;
        String first_name = body != null && body.containsKey("first_name") ? String.valueOf(body.get("first_name")).trim() : null;
        String last_name = body != null && body.containsKey("last_name") ? String.valueOf(body.get("last_name")).trim() : null;
        if (email != null && email.isEmpty()) email = null;
        if (first_name != null && first_name.isEmpty()) first_name = null;
        if (last_name != null && last_name.isEmpty()) last_name = null;
        Optional<UserDto> updated = rbacService.updateUser(id, email, first_name, last_name);
        return updated.map(u -> ResponseEntity.ok(Map.of("user", u))).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        boolean deleted = rbacService.deleteUser(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("id", id, "object", "user", "deleted", true));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/roles")
    public ResponseEntity<?> setRoles(@PathVariable String id, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> roleIds = body != null && body.containsKey("role_ids") && body.get("role_ids") instanceof List
                ? (List<String>) body.get("role_ids")
                : List.of();
        if (!rbacService.getUser(id).isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found"));
        }
        rbacService.setUserRoles(id, roleIds != null ? roleIds : List.of());
        return ResponseEntity.ok(Map.of("user_id", id, "role_ids", roleIds != null ? roleIds : List.of()));
    }
}
