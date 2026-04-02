package com.tcs.commerce.rbac.service;

import com.tcs.commerce.rbac.web.RoleDto;
import com.tcs.commerce.rbac.web.UserDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Builds {@code /admin/me} payload for the Vite backoffice: {@code is_admin}, {@code can_create_store_user}, {@code store_id}.
 */
@Service
public class BackofficeMeService {

    private final RbacService rbacService;

    private final String superAdminRoleName;
    private final String storeAdminUserRoleName;

    public BackofficeMeService(
            RbacService rbacService,
            @Value("${app.backoffice.super-admin-role-name:Super Admin}") String superAdminRoleName,
            @Value("${app.backoffice.store-admin-user-role-name:Store Admin User}") String storeAdminUserRoleName) {
        this.rbacService = rbacService;
        this.superAdminRoleName = normalizeRoleName(superAdminRoleName);
        this.storeAdminUserRoleName = normalizeRoleName(storeAdminUserRoleName);
    }

    private static String normalizeRoleName(String s) {
        if (s == null) return "";
        return s.trim().toLowerCase();
    }

    public Map<String, Object> buildMeUser(UserDto user) {
        if (user == null || user.getId() == null) {
            return Map.of();
        }
        List<RoleDto> roles = user.getRbac_roles() != null ? user.getRbac_roles() : List.of();
        boolean isAdmin = roles.stream().anyMatch(r -> superAdminRoleName.equals(normalizeRoleName(r.getName())));
        boolean canCreateStoreUser = isAdmin
            || roles.stream().anyMatch(r -> storeAdminUserRoleName.equals(normalizeRoleName(r.getName())));
        Optional<String> storeId = rbacService.findStoreIdInUserMetadata(user.getId());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", user.getId());
        out.put("email", user.getEmail() != null ? user.getEmail() : "");
        if (user.getFirst_name() != null) out.put("first_name", user.getFirst_name());
        if (user.getLast_name() != null) out.put("last_name", user.getLast_name());
        storeId.ifPresent(sid -> out.put("store_id", sid));
        out.put("is_admin", isAdmin);
        out.put("can_create_store_user", canCreateStoreUser);
        return out;
    }
}
