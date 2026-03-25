/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDUSA_BACKEND_URL?: string
  /** Java products-service base URL (substitution search, Java-only catalog). */
  readonly VITE_PRODUCTS_SERVICE_URL?: string
  /** Region id for priced variants in product search (e.g. reg_...). */
  readonly VITE_PRODUCTS_SEARCH_REGION_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
