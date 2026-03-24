import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import fs from "fs"
import path from "path"

/**
 * Serves the TCS logo for the admin welcome/login screen.
 * Place tcslogo.png in the project's public/ folder.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const filePath = path.join(process.cwd(), "public", "tcslogo.png")
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Logo not found. Add public/tcslogo.png to the project.")
  }
  res.setHeader("Content-Type", "image/png")
  const buffer = fs.readFileSync(filePath)
  return res.send(buffer)
}
