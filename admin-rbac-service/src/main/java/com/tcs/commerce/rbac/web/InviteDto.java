package com.tcs.commerce.rbac.web;

import java.util.Objects;

/**
 * Medusa-compatible invite DTO.
 */
public class InviteDto {
    private String id;
    private String email;
    private String token;
    private Boolean accepted;
    private String expires_at;
    private String created_at;
    private String updated_at;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public Boolean getAccepted() { return accepted; }
    public void setAccepted(Boolean accepted) { this.accepted = accepted; }
    public String getExpires_at() { return expires_at; }
    public void setExpires_at(String expires_at) { this.expires_at = expires_at; }
    public String getCreated_at() { return created_at; }
    public void setCreated_at(String created_at) { this.created_at = created_at; }
    public String getUpdated_at() { return updated_at; }
    public void setUpdated_at(String updated_at) { this.updated_at = updated_at; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        InviteDto inviteDto = (InviteDto) o;
        return Objects.equals(id, inviteDto.id);
    }
    @Override
    public int hashCode() { return Objects.hash(id); }
}
