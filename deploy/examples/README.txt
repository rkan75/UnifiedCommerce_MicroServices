Kubernetes / deploy examples for UnifiedCommerce Java services.

- products-service-configmap.yaml — CATALOG_* env vars (replaces MEDUSA_* / STOREFRONT_PRODUCT_TYPE_ID).
- search-service-configmap.yaml — CATALOG_* for DB table names + ADMIN_API_BASE_URL (replaces MEDUSA_ADMIN_URL).

Mount JDBC URL and credentials via a Secret (not these files). Wire ConfigMap into the Deployment envFrom.
