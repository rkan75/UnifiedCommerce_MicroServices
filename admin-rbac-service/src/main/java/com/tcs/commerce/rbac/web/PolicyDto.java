package com.tcs.commerce.rbac.web;

import java.util.Objects;

/**
 * Medusa-compatible RBAC policy DTO.
 */
public class PolicyDto {
    private String id;
    private String name;
    private String key;
    private String resource;
    private String operation;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getResource() { return resource; }
    public void setResource(String resource) { this.resource = resource; }
    public String getOperation() { return operation; }
    public void setOperation(String operation) { this.operation = operation; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PolicyDto policyDto = (PolicyDto) o;
        return Objects.equals(id, policyDto.id);
    }
    @Override
    public int hashCode() { return Objects.hash(id); }
}
