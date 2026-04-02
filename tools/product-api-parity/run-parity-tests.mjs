#!/usr/bin/env node
/**
 * Product / catalog API parity tests (Medusa Admin User Guide scope + cart, customer, search).
 *
 * Usage:
 *   node run-parity-tests.mjs --preset medusa-v2
 *   node run-parity-tests.mjs --preset java-microservices
 *   node run-parity-tests.mjs --preset java-dashboard
 *   ADMIN_BEARER_TOKEN='Bearer eyJ...' node run-parity-tests.mjs --preset java-dashboard
 *
 * Optional:
 *   --mutations     Run write/delete probes (may create data; off by default)
 *   --json          Machine-readable report on stdout
 *   --config path   Custom preset JSON (overrides --preset file)
 *
 * Env:
 *   ADMIN_BEARER_TOKEN   Bearer JWT for /admin/* (Medusa or java-dashboard)
 *   TEST_REGION_ID       Region id (e.g. reg_...) required for POST /store/carts on Java cart-service
 *   TEST_SALES_CHANNEL   Optional sales_channel_id for catalog filters
 *   FETCH_TIMEOUT_MS     Per-request timeout (default 8000)
 *
 * Node: >= 18 (uses global fetch)
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 8000);

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { preset: null, mutations: false, json: false, config: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mutations") out.mutations = true;
    else if (a === "--json") out.json = true;
    else if (a.startsWith("--preset=")) out.preset = a.slice("--preset=".length);
    else if (a === "--preset" && argv[i + 1]) out.preset = argv[++i];
    else if (a.startsWith("--config=")) out.config = a.slice("--config=".length);
    else if (a === "--config" && argv[i + 1]) out.config = argv[++i];
  }
  return out;
}

function loadPreset(args) {
  if (args.config) {
    const raw = readFileSync(args.config, "utf8");
    return JSON.parse(raw);
  }
  if (!args.preset) {
    console.error("Specify --preset medusa-v2 | java-microservices | java-dashboard or --config file.json");
    process.exit(2);
  }
  const path = join(__dirname, "presets", `${args.preset}.json`);
  if (!existsSync(path)) {
    console.error("Preset file not found:", path);
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function buildHeaders(preset, extra = {}) {
  const h = { Accept: "application/json", ...extra };
  const auth = preset.adminAuth;
  if (auth?.valueFromEnv) {
    const v = process.env[auth.valueFromEnv];
    if (v) {
      const name = auth.header || "Authorization";
      h[name] = v.startsWith("Bearer ") || name !== "Authorization" ? v : `Bearer ${v}`;
    }
  }
  if (preset.adminAuth?.cookieFromEnv) {
    const c = process.env[preset.adminAuth.cookieFromEnv];
    if (c) h.Cookie = c;
  }
  return h;
}

/** @type {Record<string, (j: any) => boolean>} */
const ASSERT = {
  productsEnvelope: (j) => j != null && Array.isArray(j.products),
  productTypesEnvelope: (j) => j != null && Array.isArray(j.product_types),
  tagsEnvelope: (j) => j != null && (Array.isArray(j.tags) || Array.isArray(j.product_tags)),
  salesChannelsEnvelope: (j) => j != null && Array.isArray(j.sales_channels),
  categoriesEnvelope: (j) => j != null && Array.isArray(j.product_categories),
  collectionsEnvelope: (j) => j != null && Array.isArray(j.collections),
  collectionOne: (j) => j != null && j.collection != null,
  cartEnvelope: (j) => j != null && j.cart != null,
  healthUp: (j) => j != null && (j.status === "UP" || j.status === "up"),
  searchEnvelope: (j) => j != null && (Array.isArray(j.products) || typeof j.count === "number"),
  adminSearchEnvelope: (j) => j != null && (Array.isArray(j.hits) || Array.isArray(j.products) || j.meta != null),
  idListEnvelope: (j) =>
    j != null &&
    (Array.isArray(j.category_ids) ||
      Array.isArray(j.collection_ids) ||
      j.category_ids != null ||
      j.collection_ids != null),
  variantsEnvelope: (j) => j != null && (Array.isArray(j.variants) || j.variant != null),
  anyJson: () => true,
};

/**
 * Each case: doc-aligned feature id, HTTP probe, and which presets run it.
 * `presets`: omit = all; or list of preset ids.
 * `needs`: host keys required on preset (skip if missing).
 * `mutations`: only with --mutations
 */
const CASES = [
  // --- Health (operational) ---
  {
    id: "health.products",
    doc: "Products service availability",
    presets: ["java-microservices", "java-dashboard"],
    host: "products",
    method: "GET",
    path: "/store/health",
    ok: [200],
    assert: "healthUp",
  },
  {
    id: "health.categories",
    doc: "Categories service availability",
    presets: ["java-microservices", "java-dashboard"],
    host: "categories",
    method: "GET",
    path: "/store/health",
    ok: [200],
    assert: "healthUp",
  },
  {
    id: "health.collections",
    doc: "Collections service availability",
    presets: ["java-microservices", "java-dashboard"],
    host: "collections",
    method: "GET",
    path: "/store/health",
    ok: [200],
    assert: "healthUp",
  },
  {
    id: "health.cart",
    doc: "Cart service availability",
    presets: ["java-microservices", "java-dashboard"],
    host: "cart",
    method: "GET",
    path: "/store/health",
    ok: [200],
    assert: "healthUp",
  },
  {
    id: "health.customer",
    doc: "Customer service availability",
    presets: ["java-microservices", "java-dashboard"],
    host: "customer",
    method: "GET",
    path: "/store/health",
    ok: [200],
    assert: "healthUp",
  },
  {
    id: "health.search",
    doc: "Search service availability",
    presets: ["java-microservices", "java-dashboard"],
    host: "search",
    method: "GET",
    path: "/search/health",
    ok: [200],
    assert: "healthUp",
  },
  {
    id: "health.medusa",
    doc: "Medusa backend health (if exposed)",
    presets: ["medusa-v2"],
    host: "default",
    method: "GET",
    path: "/health",
    ok: [200, 404],
    assert: "anyJson",
  },

  // --- Store catalog reads (User Guide: list / browse) ---
  {
    id: "store.products.list",
    doc: "ProductFuncationalities — product list (storefront)",
    host: "products",
    method: "GET",
    path: "/store/products?limit=3",
    ok: [200],
    assert: "productsEnvelope",
    medusaHost: "default",
    medusaPath: "/store/products?limit=3",
  },
  {
    id: "store.products.admin_catalog_list",
    doc: "Admin-style full catalog list (admin_catalog=1)",
    presets: ["java-microservices", "java-dashboard"],
    host: "products",
    method: "GET",
    path: "/store/products?limit=5&admin_catalog=1",
    ok: [200],
    assert: "productsEnvelope",
  },
  {
    id: "store.product_variants.list",
    doc: "Manage variants — list variants API",
    host: "products",
    method: "GET",
    path: "/store/product-variants?limit=5",
    ok: [200],
    assert: "variantsEnvelope",
    medusaHost: "default",
    medusaPath: "/store/product-variants?limit=5",
  },
  {
    id: "store.product_types.list",
    doc: "Organize step — product types picker",
    host: "products",
    method: "GET",
    path: "/store/product-types",
    ok: [200],
    assert: "productTypesEnvelope",
    medusaHost: "default",
    medusaPath: "/store/product-types",
  },
  {
    id: "store.product_tags.list",
    doc: "Organize step — tags picker",
    host: "products",
    method: "GET",
    path: "/store/product-tags",
    ok: [200],
    assert: "tagsEnvelope",
    medusaHost: "default",
    medusaPath: "/store/product-tags",
  },
  {
    id: "store.sales_channels.list",
    doc: "Organize step — sales channels picker",
    host: "products",
    method: "GET",
    path: "/store/sales-channels",
    ok: [200],
    assert: "salesChannelsEnvelope",
    medusaHost: "default",
    medusaPath: "/store/sales-channels",
  },
  {
    id: "store.catalog_scope.category_ids",
    doc: "Catalog scope — category ids for storefront",
    presets: ["java-microservices", "java-dashboard"],
    host: "products",
    method: "GET",
    path: "/store/catalog-scope/category-ids",
    ok: [200],
    assert: "idListEnvelope",
  },
  {
    id: "store.catalog_scope.collection_ids",
    doc: "Catalog scope — collection ids for storefront",
    presets: ["java-microservices", "java-dashboard"],
    host: "products",
    method: "GET",
    path: "/store/catalog-scope/collection-ids",
    ok: [200],
    assert: "idListEnvelope",
  },
  {
    id: "store.categories.list",
    doc: "Manage Product Categories — list",
    host: "categories",
    method: "GET",
    path: "/store/product-categories?limit=20",
    ok: [200],
    assert: "categoriesEnvelope",
    medusaHost: "default",
    medusaPath: "/store/product-categories?limit=20",
  },
  {
    id: "store.collections.list",
    doc: "Manage Product Collections — list",
    host: "collections",
    method: "GET",
    path: "/store/collections?limit=20",
    ok: [200],
    assert: "collectionsEnvelope",
    medusaHost: "default",
    medusaPath: "/store/collections?limit=20",
  },

  // --- Search (store + admin) ---
  {
    id: "search.store.query",
    doc: "Product search (Java search-service)",
    presets: ["java-microservices", "java-dashboard"],
    host: "search",
    method: "GET",
    path: "/search?q=test&limit=5",
    ok: [200],
    assert: "searchEnvelope",
  },
  {
    id: "search.admin",
    doc: "Admin search (dashboard → search-service)",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/search?q=test&limit=5",
    ok: [200, 401, 403],
    assert: "adminSearchEnvelope",
  },

  // --- Cart ---
  {
    id: "cart.create",
    doc: "Cart — create cart (requires region_id)",
    presets: ["java-microservices", "java-dashboard"],
    host: "cart",
    method: "POST",
    path: "/store/carts",
    bodyFromEnv: "CART_CREATE_BODY",
    ok: [200],
    assert: "cartEnvelope",
    mutations: true,
  },
  {
    id: "cart.medusa_store",
    doc: "Medusa store cart (vanilla v2)",
    presets: ["medusa-v2"],
    host: "default",
    method: "POST",
    path: "/store/carts",
    bodyFromEnv: "CART_CREATE_BODY",
    ok: [200],
    assert: "cartEnvelope",
    mutations: true,
  },

  // --- Customer (store) ---
  {
    id: "customer.me_unauthenticated",
    doc: "Customer — GET /customers/me without session (expect 401)",
    presets: ["java-microservices", "java-dashboard"],
    host: "customer",
    method: "GET",
    path: "/store/customers/me",
    ok: [401, 403],
    assert: "anyJson",
  },
  {
    id: "customer.me_unauthenticated.medusa",
    doc: "Customer — GET /customers/me without session (Medusa)",
    presets: ["medusa-v2"],
    host: "default",
    method: "GET",
    path: "/store/customers/me",
    ok: [401, 403, 400],
    assert: "anyJson",
  },

  // --- Admin: list products (Medusa v2 vs Java dashboard) ---
  {
    id: "admin.products.list.medusa",
    doc: "Medusa Admin — product list",
    presets: ["medusa-v2"],
    host: "default",
    method: "GET",
    path: "/admin/products?limit=5",
    ok: [200, 401],
    assert: "productsEnvelope",
  },
  {
    id: "admin.products.list.dashboard",
    doc: "Java dashboard — proxy admin product list",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/products?limit=5",
    ok: [200, 401, 403],
    assert: "productsEnvelope",
  },
  {
    id: "admin.product_categories.list.medusa",
    doc: "Medusa Admin — product categories",
    presets: ["medusa-v2"],
    host: "default",
    method: "GET",
    path: "/admin/product-categories?limit=10",
    ok: [200, 401],
    assert: "categoriesEnvelope",
  },
  {
    id: "admin.product_categories.list.dashboard",
    doc: "Java dashboard — product categories (proxied)",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/product-categories?limit=10",
    ok: [200, 401, 403],
    assert: "categoriesEnvelope",
  },
  {
    id: "admin.collections.list.medusa",
    doc: "Medusa Admin — collections",
    presets: ["medusa-v2"],
    host: "default",
    method: "GET",
    path: "/admin/collections?limit=10",
    ok: [200, 401],
    assert: "collectionsEnvelope",
  },
  {
    id: "admin.collections.list.dashboard",
    doc: "Java dashboard — collections (proxied as product-collections)",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/product-collections?limit=10",
    ok: [200, 401, 403],
    assert: "collectionsEnvelope",
  },
  {
    id: "admin.product_types.dashboard",
    doc: "Java dashboard — product types proxy",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/product-types",
    ok: [200, 401, 403],
    assert: "productTypesEnvelope",
  },
  {
    id: "admin.sales_channels.dashboard",
    doc: "Java dashboard — sales channels proxy",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/sales-channels",
    ok: [200, 401, 403],
    assert: "salesChannelsEnvelope",
  },
  {
    id: "admin.search.meta.dashboard",
    doc: "Admin search metadata",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "GET",
    path: "/admin/search/meta",
    ok: [200, 401, 403],
    assert: "anyJson",
  },
  {
    id: "admin.products.export.start",
    doc: "Export Products — POST starts async export job",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "POST",
    path: "/admin/products/export",
    body: {},
    ok: [202, 400, 401, 403],
    assert: "anyJson",
  },

  // --- Write probes (optional) ---
  {
    id: "admin.products.create.minimal",
    doc: "Create Product — POST minimal (destructive / creates row)",
    presets: ["java-microservices"],
    host: "products",
    method: "POST",
    path: "/admin/products",
    body: {
      title: `Parity test product ${Date.now()}`,
      status: "draft",
      discountable: true,
    },
    ok: [200, 201, 400],
    assert: "anyJson",
    mutations: true,
  },
  {
    id: "admin.products.create.dashboard",
    doc: "Create Product via dashboard proxy",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "POST",
    path: "/admin/products",
    body: {
      title: `Parity test product ${Date.now()}`,
      status: "draft",
      discountable: true,
    },
    ok: [200, 201, 400, 401, 403],
    assert: "anyJson",
    mutations: true,
    requireAuth: true,
  },
  {
    id: "admin.products.batch.dashboard",
    doc: "Import Products — batch create",
    presets: ["java-dashboard"],
    host: "dashboard",
    method: "POST",
    path: "/admin/products/batch",
    body: { products: [{ title: `Batch parity ${Date.now()}`, status: "draft" }] },
    ok: [200, 400, 401, 403],
    assert: "anyJson",
    mutations: true,
    requireAuth: true,
  },
  {
    id: "store.categories.create",
    doc: "Categories — POST create (Java only)",
    presets: ["java-microservices", "java-dashboard"],
    host: "categories",
    method: "POST",
    path: "/store/product-categories",
    body: { name: `Parity cat ${Date.now()}`, is_active: true },
    ok: [200, 201, 400],
    assert: "categoriesEnvelope",
    mutations: true,
  },
  {
    id: "admin.collections.create.medusa",
    doc: "Medusa Admin — create collection",
    presets: ["medusa-v2"],
    host: "default",
    method: "POST",
    path: "/admin/collections",
    body: { title: `Parity collection ${Date.now()}` },
    ok: [200, 201, 400, 401],
    assert: "anyJson",
    mutations: true,
    requireAuth: true,
  },
];

function resolveUrl(preset, c) {
  const pid = preset.id;
  let hostKey = c.host;
  let path = c.path;
  if (pid === "medusa-v2") {
    if (c.medusaHost) {
      hostKey = c.medusaHost;
      if (c.medusaPath) path = c.medusaPath;
    } else {
      /** Vanilla Medusa: one origin; Java uses per-service hosts (products, categories, …). */
      hostKey = "default";
    }
  }
  const base = preset.hosts[hostKey];
  if (!base) return null;
  const u = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  return u;
}

function skipReason(preset, c, args) {
  if (c.presets && !c.presets.includes(preset.id)) return "not in preset filter";
  if (c.mutations && !args.mutations) return "needs --mutations";
  const hostKey =
    preset.id === "medusa-v2" && c.medusaHost ? c.medusaHost : c.host;
  if (!preset.hosts[hostKey]) return `missing host "${hostKey}"`;
  if (c.requireAuth === true) {
    const tok = process.env.ADMIN_BEARER_TOKEN;
    const cookie = process.env.ADMIN_SESSION_COOKIE;
    if (!tok && !cookie) return "needs ADMIN_BEARER_TOKEN or ADMIN_SESSION_COOKIE";
  }
  if (c.id === "cart.create" || c.id === "cart.medusa_store") {
    const body = process.env.CART_CREATE_BODY || buildDefaultCartBody();
    if (!body) return "needs TEST_REGION_ID or CART_CREATE_BODY";
  }
  return null;
}

function buildDefaultCartBody() {
  const rid = process.env.TEST_REGION_ID;
  if (!rid) return null;
  return JSON.stringify({ region_id: rid });
}

async function runCase(preset, c, args) {
  const reason = skipReason(preset, c, args);
  if (reason) {
    return { id: c.id, doc: c.doc, status: "SKIP", detail: reason };
  }
  const url = resolveUrl(preset, c);
  if (!url) return { id: c.id, doc: c.doc, status: "SKIP", detail: "could not resolve URL" };

  const headers = buildHeaders(preset, { "Content-Type": "application/json" });

  let body = undefined;
  if (c.method === "POST" || c.method === "PATCH" || c.method === "PUT") {
    if (c.bodyFromEnv) {
      const raw = process.env[c.bodyFromEnv] || buildDefaultCartBody();
      body = raw || "{}";
    } else if (c.body) {
      body = JSON.stringify(c.body);
    }
  }

  let res;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
    try {
      res = await fetch(url, { method: c.method, headers, body, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    return {
      id: c.id,
      doc: c.doc,
      status: "FAIL",
      http: 0,
      detail: (e && e.message) || String(e),
      url,
    };
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const ok = c.ok.includes(res.status);
  const fn = ASSERT[c.assert] || ASSERT.anyJson;
  const bodyOk = json == null ? c.assert === "anyJson" : fn(json);
  /** 401/403 listed in ok[] → pass without body shape check (unauthorized or forbidden). */
  const softAuth =
    (c.ok.includes(401) && res.status === 401) || (c.ok.includes(403) && res.status === 403);
  const pass = ok && (softAuth || bodyOk);

  return {
    id: c.id,
    doc: c.doc,
    status: pass ? "PASS" : "FAIL",
    http: res.status,
    detail: pass ? "" : !ok ? `unexpected status (allowed ${c.ok.join(",")})` : `body assert failed: ${c.assert}`,
    url,
    snippet: text.length > 240 ? `${text.slice(0, 240)}…` : text,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const preset = loadPreset(args);
  const results = [];
  for (const c of CASES) {
    results.push(await runCase(preset, c, args));
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;

  if (args.json) {
    console.log(JSON.stringify({ preset: preset.id, pass, fail, skip, results }, null, 2));
  } else {
    console.log(`\nPreset: ${preset.label || preset.id}`);
    console.log("---");
    for (const r of results) {
      const line = `${r.status.padEnd(5)} ${r.id}`;
      console.log(line + (r.http ? `  HTTP ${r.http}` : "") + (r.detail ? `  (${r.detail})` : ""));
      if (r.status === "FAIL" && r.url) console.log(`       ${r.url}`);
    }
    console.log("---");
    console.log(`PASS ${pass}  FAIL ${fail}  SKIP ${skip}`);
    if (preset.description) console.log(`\nNote: ${preset.description}`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
