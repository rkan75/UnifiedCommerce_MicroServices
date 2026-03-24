import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import fs from "fs"
import path from "path"

/**
 * Serves the store logo for the admin welcome/login screen.
 * Place store-logo.png in the project's public/ folder.
 * Used by the dashboard patch (avatar-box) at img src="/admin/logo"
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const filePath = path.join(process.cwd(), "public", "store-logo.png")
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Logo not found. Add public/store-logo.png to the project.")
  }
  res.setHeader("Content-Type", "image/png")
  const buffer = fs.readFileSync(filePath)
  return res.send(buffer)
}
