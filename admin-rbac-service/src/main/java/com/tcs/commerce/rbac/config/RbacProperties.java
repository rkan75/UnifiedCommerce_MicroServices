package com.tcs.commerce.rbac.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configurable table names to match Medusa DB schema (e.g. "user" is reserved in PostgreSQL).
 */
@Component
@ConfigurationProperties(prefix = "app.rbac")
public class RbacProperties {

    private String tableSchema = "public";
    private String userTable = "user";
    private String inviteTable = "invite";
    private String roleTable = "rbac_role";
    private String policyTable = "rbac_policy";
    private String userRoleLinkTable = "user_rbac_role";
    private String rolePolicyLinkTable = "rbac_role_rbac_policy";

    public String getTableSchema() { return tableSchema; }
    public void setTableSchema(String tableSchema) { this.tableSchema = tableSchema; }
    public String getUserTable() { return userTable; }
    public void setUserTable(String userTable) { this.userTable = userTable; }
    public String getInviteTable() { return inviteTable; }
    public void setInviteTable(String inviteTable) { this.inviteTable = inviteTable; }
    public String getRoleTable() { return roleTable; }
    public void setRoleTable(String roleTable) { this.roleTable = roleTable; }
    public String getPolicyTable() { return policyTable; }
    public void setPolicyTable(String policyTable) { this.policyTable = policyTable; }
    public String getUserRoleLinkTable() { return userRoleLinkTable; }
    public void setUserRoleLinkTable(String userRoleLinkTable) { this.userRoleLinkTable = userRoleLinkTable; }
    public String getRolePolicyLinkTable() { return rolePolicyLinkTable; }
    public void setRolePolicyLinkTable(String rolePolicyLinkTable) { this.rolePolicyLinkTable = rolePolicyLinkTable; }

    /** Qualified table name for SQL (schema.table). Use quoted identifier for reserved words like "user". */
    public String qualifiedUserTable() {
        String schema = (tableSchema != null && !tableSchema.isBlank()) ? tableSchema : "public";
        String table = (userTable != null && !userTable.isBlank()) ? userTable : "user";
        if ("user".equalsIgnoreCase(table.trim())) {
            return schema + ".\"" + table + "\"";
        }
        return schema + "." + table;
    }

    public String qualifiedInviteTable() {
        String schema = (tableSchema != null && !tableSchema.isBlank()) ? tableSchema : "public";
        String table = (inviteTable != null && !inviteTable.isBlank()) ? inviteTable : "invite";
        return schema + "." + table;
    }

    public String qualifiedRoleTable() {
        String schema = (tableSchema != null && !tableSchema.isBlank()) ? tableSchema : "public";
        String table = (roleTable != null && !roleTable.isBlank()) ? roleTable : "rbac_role";
        return schema + "." + table;
    }

    public String qualifiedPolicyTable() {
        String schema = (tableSchema != null && !tableSchema.isBlank()) ? tableSchema : "public";
        String table = (policyTable != null && !policyTable.isBlank()) ? policyTable : "rbac_policy";
        return schema + "." + table;
    }

    public String qualifiedUserRoleLinkTable() {
        String schema = (tableSchema != null && !tableSchema.isBlank()) ? tableSchema : "public";
        String table = (userRoleLinkTable != null && !userRoleLinkTable.isBlank()) ? userRoleLinkTable : "user_rbac_role";
        return schema + "." + table;
    }

    public String qualifiedRolePolicyLinkTable() {
        String schema = (tableSchema != null && !tableSchema.isBlank()) ? tableSchema : "public";
        String table = (rolePolicyLinkTable != null && !rolePolicyLinkTable.isBlank()) ? rolePolicyLinkTable : "rbac_role_rbac_policy";
        return schema + "." + table;
    }
}
