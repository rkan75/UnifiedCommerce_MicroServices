import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
        target: process.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9010",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            if (res && !res.headersSent && (err as NodeJS.ErrnoException).code === "ECONNREFUSED") {
              res.writeHead(503, { "Content-Type": "application/json" })
              res.end(
                JSON.stringify({
                  message:
                    "Backend unreachable. Start admin-dashboard on 9010 (Java) or Medusa on 9000; set VITE_MEDUSA_BACKEND_URL if needed.",
                  code: "ECONNREFUSED",
                })
              )
            }
          })
        },
      },
      "/auth": {
        target: process.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9010",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            if (res && !res.headersSent && (err as NodeJS.ErrnoException).code === "ECONNREFUSED") {
              res.writeHead(503, { "Content-Type": "application/json" })
              res.end(
                JSON.stringify({
                  message:
                    "Backend unreachable. Start admin-dashboard on 9010 (Java) or Medusa on 9000; set VITE_MEDUSA_BACKEND_URL if needed.",
                  code: "ECONNREFUSED",
                })
              )
            }
          })
        },
      },
    },
  },
})
