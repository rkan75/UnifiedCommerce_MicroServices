package com.tcs.commerce.rbac.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Medusa-compatible admin user DTO (with rbac_roles for list/get).
 */
public class UserDto {
    private String id;
    private String email;
    private String first_name;
    private String last_name;
    private String avatar_url;
    private Object metadata;
    private String created_at;
    private String updated_at;
    private String deleted_at;
    private List<RoleDto> rbac_roles = new ArrayList<>();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getFirst_name() { return first_name; }
    public void setFirst_name(String first_name) { this.first_name = first_name; }
    public String getLast_name() { return last_name; }
    public void setLast_name(String last_name) { this.last_name = last_name; }
    public String getAvatar_url() { return avatar_url; }
    public void setAvatar_url(String avatar_url) { this.avatar_url = avatar_url; }
    public Object getMetadata() { return metadata; }
    public void setMetadata(Object metadata) { this.metadata = metadata; }
    public String getCreated_at() { return created_at; }
    public void setCreated_at(String created_at) { this.created_at = created_at; }
    public String getUpdated_at() { return updated_at; }
    public void setUpdated_at(String updated_at) { this.updated_at = updated_at; }
    public String getDeleted_at() { return deleted_at; }
    public void setDeleted_at(String deleted_at) { this.deleted_at = deleted_at; }
    public List<RoleDto> getRbac_roles() { return rbac_roles; }
    public void setRbac_roles(List<RoleDto> rbac_roles) { this.rbac_roles = rbac_roles != null ? rbac_roles : new ArrayList<>(); }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserDto userDto = (UserDto) o;
        return Objects.equals(id, userDto.id);
    }
    @Override
    public int hashCode() { return Objects.hash(id); }
}
