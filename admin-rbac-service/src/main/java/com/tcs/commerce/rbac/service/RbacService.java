package com.tcs.commerce.rbac.service;

import com.tcs.commerce.rbac.config.RbacProperties;
import com.tcs.commerce.rbac.web.InviteDto;
import com.tcs.commerce.rbac.web.PolicyDto;
import com.tcs.commerce.rbac.web.RoleDto;
import com.tcs.commerce.rbac.web.UserDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RbacService {

    private final JdbcTemplate jdbc;
    private final RbacProperties props;

    public RbacService(JdbcTemplate jdbc, RbacProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    private static final RowMapper<RoleDto> ROLE_MAPPER = (rs, i) -> {
        RoleDto dto = new RoleDto();
        dto.setId(getString(rs, "id"));
        dto.setName(getString(rs, "name"));
        dto.setDescription(getString(rs, "description"));
        return dto;
    };

    private static final RowMapper<UserDto> USER_MAPPER = (rs, i) -> {
        UserDto dto = new UserDto();
        dto.setId(getString(rs, "id"));
        dto.setEmail(getString(rs, "email"));
        dto.setFirst_name(getString(rs, "first_name"));
        dto.setLast_name(getString(rs, "last_name"));
        dto.setAvatar_url(getString(rs, "avatar_url"));
        dto.setCreated_at(getTimestampStr(rs, "created_at"));
        dto.setUpdated_at(getTimestampStr(rs, "updated_at"));
        dto.setDeleted_at(getTimestampStr(rs, "deleted_at"));
        return dto;
    };

    private static final RowMapper<InviteDto> INVITE_MAPPER = (rs, i) -> {
        InviteDto dto = new InviteDto();
        dto.setId(getString(rs, "id"));
        dto.setEmail(getString(rs, "email"));
        dto.setToken(getString(rs, "token"));
        dto.setAccepted(getBoolean(rs, "accepted"));
        dto.setExpires_at(getTimestampStr(rs, "expires_at"));
        dto.setCreated_at(getTimestampStr(rs, "created_at"));
        dto.setUpdated_at(getTimestampStr(rs, "updated_at"));
        return dto;
    };

    private static final RowMapper<PolicyDto> POLICY_MAPPER = (rs, i) -> {
        PolicyDto dto = new PolicyDto();
        dto.setId(getString(rs, "id"));
        dto.setName(getString(rs, "name"));
        dto.setKey(getString(rs, "key"));
        dto.setResource(getString(rs, "resource"));
        dto.setOperation(getString(rs, "operation"));
        return dto;
    };

    private static String getString(ResultSet rs, String col) {
        try {
            return rs.getString(col);
        } catch (SQLException e) {
            return null;
        }
    }

    private static Boolean getBoolean(ResultSet rs, String col) {
        try {
            boolean v = rs.getBoolean(col);
            if (rs.wasNull()) return null;
            return v;
        } catch (SQLException e) {
            return null;
        }
    }

    private static String getTimestampStr(ResultSet rs, String col) {
        try {
            Timestamp ts = rs.getTimestamp(col);
            return ts == null ? null : ts.toInstant().toString();
        } catch (SQLException e) {
            return null;
        }
    }

    public List<RoleDto> listRoles() {
        String sql = "SELECT id, name, description FROM " + props.qualifiedRoleTable() + " ORDER BY name";
        return jdbc.query(sql, ROLE_MAPPER);
    }

    public List<UserDto> listUsers(int skip, int take) {
        String userTable = props.qualifiedUserTable();
        String linkTable = props.qualifiedUserRoleLinkTable();
        String roleTable = props.qualifiedRoleTable();
        // List users (optionally with pagination); then load roles per user
        String sql = "SELECT id, email, first_name, last_name, avatar_url, created_at, updated_at, deleted_at FROM " + userTable + " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        List<UserDto> users = jdbc.query(sql, USER_MAPPER, take, skip);
        for (UserDto u : users) {
            if (u.getId() != null) {
                u.setRbac_roles(getRolesForUser(u.getId()));
            }
        }
        return users;
    }

    public Optional<UserDto> getUser(String userId) {
        String userTable = props.qualifiedUserTable();
        String sql = "SELECT id, email, first_name, last_name, avatar_url, created_at, updated_at, deleted_at FROM " + userTable + " WHERE id = ?";
        List<UserDto> list = jdbc.query(sql, USER_MAPPER, userId);
        if (list.isEmpty()) return Optional.empty();
        UserDto u = list.get(0);
        u.setRbac_roles(getRolesForUser(u.getId()));
        return Optional.of(u);
    }

    private List<RoleDto> getRolesForUser(String userId) {
        String linkTable = props.qualifiedUserRoleLinkTable();
        String roleTable = props.qualifiedRoleTable();
        String sql = "SELECT r.id, r.name, r.description FROM " + roleTable + " r INNER JOIN " + linkTable + " ur ON ur.rbac_role_id = r.id WHERE ur.user_id = ?";
        return jdbc.query(sql, ROLE_MAPPER, userId);
    }

    @Transactional
    public Optional<UserDto> updateUser(String userId, String email, String first_name, String last_name) {
        String userTable = props.qualifiedUserTable();
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        setClauses.add("updated_at = ?");
        params.add(Timestamp.from(Instant.now()));
        if (email != null) { setClauses.add("email = ?"); params.add(email); }
        if (first_name != null) { setClauses.add("first_name = ?"); params.add(first_name); }
        if (last_name != null) { setClauses.add("last_name = ?"); params.add(last_name); }
        params.add(userId);
        String sql = "UPDATE " + userTable + " SET " + String.join(", ", setClauses) + " WHERE id = ?";
        int updated = jdbc.update(sql, params.toArray());
        if (updated == 0) return Optional.empty();
        return getUser(userId);
    }

    @Transactional
    public boolean deleteUser(String userId) {
        String linkTable = props.qualifiedUserRoleLinkTable();
        String userTable = props.qualifiedUserTable();
        jdbc.update("DELETE FROM " + linkTable + " WHERE user_id = ?", userId);
        int deleted = jdbc.update("DELETE FROM " + userTable + " WHERE id = ?", userId);
        return deleted > 0;
    }

    @Transactional
    public void setUserRoles(String userId, List<String> roleIds) {
        String linkTable = props.qualifiedUserRoleLinkTable();
        jdbc.update("DELETE FROM " + linkTable + " WHERE user_id = ?", userId);
        for (String roleId : roleIds) {
            if (roleId == null || roleId.isBlank()) continue;
            jdbc.update("INSERT INTO " + linkTable + " (user_id, rbac_role_id) VALUES (?, ?)", userId, roleId);
        }
    }

    public List<InviteDto> listInvites(int skip, int take) {
        String sql = "SELECT id, email, token, accepted, expires_at, created_at, updated_at FROM " + props.qualifiedInviteTable() + " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        return jdbc.query(sql, INVITE_MAPPER, take, skip);
    }

    @Transactional
    public Optional<InviteDto> createInvite(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        email = email.trim().toLowerCase();
        String inviteTable = props.qualifiedInviteTable();
        // Check existing invite or user with same email
        List<InviteDto> existing = jdbc.query("SELECT id FROM " + inviteTable + " WHERE LOWER(email) = ? AND (accepted IS NULL OR accepted = false)", (rs, i) -> { InviteDto d = new InviteDto(); d.setId(rs.getString("id")); return d; }, email);
        if (!existing.isEmpty()) return Optional.empty();
        String userTable = props.qualifiedUserTable();
        Long userCount = jdbc.queryForObject("SELECT COUNT(*) FROM " + userTable + " WHERE LOWER(email) = ?", Long.class, email);
        if (userCount != null && userCount > 0) return Optional.empty();

        String id = "inv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 26);
        String token = UUID.randomUUID().toString().replace("-", "");
        Timestamp expiresAt = Timestamp.from(Instant.now().plusSeconds(7 * 24 * 3600));
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO " + inviteTable + " (id, email, token, accepted, expires_at, created_at, updated_at) VALUES (?, ?, ?, false, ?, ?, ?)",
            id, email, token, expiresAt, now, now);
        List<InviteDto> one = jdbc.query("SELECT id, email, token, accepted, expires_at, created_at, updated_at FROM " + inviteTable + " WHERE id = ?", INVITE_MAPPER, id);
        return one.isEmpty() ? Optional.empty() : Optional.of(one.get(0));
    }

    public List<PolicyDto> listPolicies() {
        try {
            String sql = "SELECT id, name, key, resource, operation FROM " + props.qualifiedPolicyTable() + " ORDER BY resource, operation";
            return jdbc.query(sql, POLICY_MAPPER);
        } catch (Exception e) {
            return List.of();
        }
    }
}
