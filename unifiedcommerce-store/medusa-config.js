"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
(0, utils_1.loadEnv)(process.env.NODE_ENV || 'development', process.cwd());
/**
 * Validates email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Validates SendGrid API key format (starts with SG.)
 */
function isValidSendGridApiKey(apiKey) {
    return apiKey.startsWith('SG.') && apiKey.length > 20;
}
/**
 * Validates and logs SendGrid configuration
 */
function validateSendGridConfig() {
    const errors = [];
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!apiKey) {
        errors.push('SENDGRID_API_KEY is not set');
    }
    else if (!isValidSendGridApiKey(apiKey)) {
        errors.push('SENDGRID_API_KEY format appears invalid (should start with SG.)');
    }
    if (!fromEmail) {
        errors.push('SENDGRID_FROM_EMAIL is not set');
    }
    else if (!isValidEmail(fromEmail)) {
        errors.push(`SENDGRID_FROM_EMAIL format is invalid: ${fromEmail}`);
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
// databaseDriverOptions is what Medusa uses (not databaseExtra). For localhost (e.g. Cloud SQL Proxy) use no SSL and longer timeout.
let dbUrl = process.env.DATABASE_URL || '';
const isLocalDb = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
// Force no SSL and connect timeout in URL so pg client always gets them (more reliable than driverOptions).
if (isLocalDb && dbUrl) {
    const sep = dbUrl.includes('?') ? '&' : '?';
    const params = ['sslmode=disable', 'connect_timeout=30'];
    const existing = dbUrl.includes('?') ? dbUrl.slice(dbUrl.indexOf('?')) : '';
    const add = params.filter(function (p) { return !existing.includes(p.split('=')[0] + '='); }).join('&');
    if (add) dbUrl = dbUrl + sep + add;
}
let databaseDriverOptions = {};
if (isLocalDb) {
    databaseDriverOptions = {
        connection: {
            ssl: false,
            connectionTimeoutMillis: 30000,
        },
    };
}
else {
    if (process.env.DATABASE_EXTRA) {
        try {
            const extra = JSON.parse(process.env.DATABASE_EXTRA);
            databaseDriverOptions = { connection: { ssl: extra.ssl ?? { rejectUnauthorized: false } } };
        }
        catch (e) {
            console.warn('⚠️  Failed to parse DATABASE_EXTRA, using defaults');
            databaseDriverOptions = { connection: { ssl: { rejectUnauthorized: false } } };
        }
    }
    else {
        databaseDriverOptions = { connection: { ssl: { rejectUnauthorized: false } } };
    }
}
const config = {
    projectConfig: {
        databaseUrl: dbUrl,
        databaseDriverOptions,
        http: {
            storeCors: process.env.STORE_CORS,
            adminCors: process.env.ADMIN_CORS,
            authCors: process.env.AUTH_CORS,
            jwtSecret: process.env.JWT_SECRET || "supersecret",
            cookieSecret: process.env.COOKIE_SECRET || "supersecret",
        }
    },
    plugins: [
        {
            resolve: "@rsc-labs/medusa-wishlist",
            options: {
                jwtSecret: process.env.JWT_SECRET || "supersecret",
            },
        },
        // Algolia search plugin
        ...(process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_ADMIN_API_KEY
            ? [
                {
                    resolve: "medusa-plugin-algolia",
                    options: {
                        applicationId: process.env.ALGOLIA_APP_ID,
                        adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
                        settings: {
                            products: {
                                indexSettings: {
                                    searchableAttributes: [
                                        "title",
                                        "description",
                                        "tags",
                                        "collection_title",
                                        "variant_sku",
                                        "options",
                                    ],
                                    attributesToRetrieve: [
                                        "id",
                                        "title",
                                        "description",
                                        "handle",
                                        "thumbnail",
                                        "variants",
                                        "variant_sku",
                                        "options",
                                        "collection_title",
                                        "collection_handle",
                                        "images",
                                        "metadata",
                                    ],
                                    attributesForFaceting: [
                                        "filterOnly(collection_handle)",
                                        "filterOnly(options)",
                                    ],
                                },
                                transformer: (product) => {
                                    return {
                                        id: product.id,
                                        title: product.title,
                                        description: product.description,
                                        handle: product.handle,
                                        thumbnail: product.thumbnail,
                                        variants: product.variants?.map((v) => ({
                                            id: v.id,
                                            title: v.title,
                                            sku: v.sku,
                                        })),
                                        variant_sku: product.variants
                                            ?.map((v) => v.sku)
                                            .filter(Boolean)
                                            .join(" "),
                                        options: product.options?.map((o) => o.title).join(" "),
                                        collection_title: product.collection?.title,
                                        collection_handle: product.collection?.handle,
                                        images: product.images?.map((img) => img.url),
                                        metadata: product.metadata,
                                    };
                                },
                            },
                        },
                    },
                },
            ]
            : []),
    ],
    // Modules must be an object keyed by module name so container.resolve("recipe") and resolve("storeLocator") work
    modules: {},
};
// Add Notification module with SendGrid provider (if configured)
const sendGridApiKey = process.env.SENDGRID_API_KEY;
const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL;
if (sendGridApiKey && sendGridFromEmail) {
    const validation = validateSendGridConfig();
    if (validation.isValid) {
        try {
            config.modules.notification = {
                resolve: "@medusajs/medusa/notification",
                options: {
                    providers: [
                        {
                            resolve: "@medusajs/medusa/notification-sendgrid",
                            id: "sendgrid",
                            options: {
                                api_key: sendGridApiKey,
                                from: sendGridFromEmail,
                                channels: ["email"], // Explicitly declare email channel support
                            },
                        },
                    ],
                },
            };
            console.log('✅ SendGrid notification provider configured successfully');
            console.log(`   From email: ${sendGridFromEmail}`);
            console.log(`   API key: ${sendGridApiKey.substring(0, 10)}...${sendGridApiKey.substring(sendGridApiKey.length - 4)}`);
        }
        catch (error) {
            console.error('❌ Error configuring SendGrid notification provider:', error);
            console.error('   Email notifications will not be sent');
        }
    }
    else {
        console.warn('⚠️  SendGrid notification provider configuration is invalid:');
        validation.errors.forEach((error) => {
            console.warn(`   - ${error}`);
        });
        console.warn('   Email notifications will not be sent until configuration is fixed');
    }
}
else {
    if (process.env.NODE_ENV === 'development') {
        console.log('ℹ️  SendGrid notification provider not configured');
        console.log('   Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env to enable email notifications');
    }
}
// Add RBAC module when feature flag is enabled
if (process.env.MEDUSA_FF_RBAC === "true") {
    try {
        config.modules.rbac = {
            resolve: "@medusajs/medusa/rbac",
        };
        console.log('✅ RBAC module configured');
    }
    catch (error) {
        console.error('❌ Error configuring RBAC module:', error);
    }
}
else {
    console.log('ℹ️  RBAC module not enabled (set MEDUSA_FF_RBAC=true to enable)');
}
// Recipe module: recipes with steps and product-variant ingredients (add-to-cart support)
config.modules.recipe = {
    resolve: "./src/modules/recipe",
    options: {},
};
// Store locator module: physical store locations (name, address, lat/lng, opening_hours)
config.modules.storeLocator = {
    resolve: "./src/modules/store-locator",
    options: {},
};
// Log Algolia plugin status
if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_ADMIN_API_KEY) {
    console.log("✅ Algolia search plugin configured");
}
else {
    if (process.env.NODE_ENV === "development") {
        console.log("ℹ️  Algolia search plugin not configured");
        console.log("   Set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY in .env to enable Algolia search");
    }
}
module.exports = (0, utils_1.defineConfig)(config);
