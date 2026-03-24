package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.service.RbacService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * GET /admin/roles and GET /admin/rbac/roles - list RBAC roles (Medusa-compatible).
 */
@RestController
@RequestMapping({"/admin/roles", "/admin/rbac/roles"})
public class RolesController {

    private final RbacService rbacService;

    public RolesController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public ResponseEntity<Map<String, List<RoleDto>>> list() {
        return ResponseEntity.ok(Map.of("roles", rbacService.listRoles()));
    }
}
