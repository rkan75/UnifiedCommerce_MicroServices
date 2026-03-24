import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 7000,
        proxy: {
            "/admin": {
                target: process.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000",
                changeOrigin: true,
            },
            "/auth": {
                target: process.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000",
                changeOrigin: true,
            },
        },
    },
});
