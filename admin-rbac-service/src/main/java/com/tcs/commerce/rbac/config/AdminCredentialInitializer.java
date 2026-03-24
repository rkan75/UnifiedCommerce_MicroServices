package com.tcs.commerce.rbac.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;

@Component
public class AdminCredentialInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final AdminAuthProperties authProps;
    private final RbacProperties rbacProps;

    public AdminCredentialInitializer(JdbcTemplate jdbc, AdminAuthProperties authProps, RbacProperties rbacProps) {
        this.jdbc = jdbc;
        this.authProps = authProps;
        this.rbacProps = rbacProps;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String schema = rbacProps.getTableSchema();
        String table = authProps.getCredentialTable();
        String schemaName = (schema != null && !schema.isBlank()) ? schema : "public";
        String tableName = (table != null && !table.isBlank()) ? table : "admin_credential";
        Boolean exists = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?)", Boolean.class, schemaName, tableName);
        if (Boolean.TRUE.equals(exists)) return;
        try {
            ClassPathResource res = new ClassPathResource("schema-admin-credential.sql");
            String sql = StreamUtils.copyToString(res.getInputStream(), StandardCharsets.UTF_8);
            // Strip line comments then run each statement (first segment was skipped before because it started with --)
            for (String stmt : sql.split(";")) {
                String s = stmt.replaceAll("(?m)^\\s*--.*$", "").trim();
                if (!s.isEmpty()) jdbc.execute(s);
            }
        } catch (Exception ex) {
            // Log so we don't silently fail
            org.slf4j.LoggerFactory.getLogger(AdminCredentialInitializer.class).warn("Could not create admin_credential table: {}", ex.getMessage());
        }
    }
}
