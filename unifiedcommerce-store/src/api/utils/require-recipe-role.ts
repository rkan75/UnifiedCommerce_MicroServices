import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/** Role names allowed to manage recipes (Admin, Content Manager, Product Manager, Super Admin). */
export const RECIPE_ALLOWED_ROLE_NAMES = [
  "Super Admin",
  "Admin",
  "Content Manager",
  "Product Manager",
]

/**
 * Ensures the current admin user has one of the allowed roles for recipe management.
 * Call at the start of admin recipe routes. Sends 401/403 and returns false if not allowed.
 */
export async function requireRecipeRole(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<boolean> {
  const actorId = (req as any).auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ message: "Unauthorized" })
    return false
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: {
        entity: string
        fields: string[]
        filters: { id: string }
      }) => Promise<{ data: { id: string; rbac_roles?: { name: string }[] }[] }>
    }
    const { data: users } = await query.graph({
      entity: "user",
      fields: ["rbac_roles.name"],
      filters: { id: actorId },
    })
    const roles = users?.[0]?.rbac_roles ?? []
    const roleNames = new Set(roles.map((r) => r.name))
    const hasAllowedRole = RECIPE_ALLOWED_ROLE_NAMES.some((name) => roleNames.has(name))
    if (!hasAllowedRole) {
      res.status(403).json({
        message:
          "Access denied. Recipe management is allowed only for Admin, Content Manager, or Product Manager roles.",
      })
      return false
    }
    return true
  } catch {
    res.status(403).json({ message: "Access denied" })
    return false
  }
}
