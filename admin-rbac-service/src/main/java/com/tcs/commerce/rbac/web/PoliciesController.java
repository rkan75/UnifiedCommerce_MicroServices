package com.tcs.commerce.rbac.web;

import com.tcs.commerce.rbac.service.RbacService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * GET /admin/policies - list RBAC policies (Medusa-compatible).
 * Returns empty list if rbac_policy table does not exist.
 */
@RestController
@RequestMapping("/admin/policies")
public class PoliciesController {

    private final RbacService rbacService;

    public PoliciesController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public ResponseEntity<List<PolicyDto>> list() {
        return ResponseEntity.ok(rbacService.listPolicies());
    }
}
