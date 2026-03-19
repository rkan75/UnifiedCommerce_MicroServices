import { createInvitesWorkflow } from "@medusajs/core-flows"
import { getAuthContextFromJwtToken } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"

/** Opt out of framework auth so we enforce auth in-handler (avoids "invite:undefined" permission error). */
export const AUTHENTICATE = false

const COOKIE_NAME = "medusa_admin_token"

function getBearerFromRequest(req: MedusaRequest): string | undefined {
  const auth = req.headers?.authorization
  if (auth && (auth.startsWith("Bearer ") || auth.startsWith("bearer "))) return auth
  const cookie = (req as any).cookies?.[COOKIE_NAME]
  if (cookie) return `Bearer ${cookie}`
  const raw = (req.headers?.cookie as string) || ""
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
  if (m) {
    try {
      return `Bearer ${decodeURIComponent(m[1].trim())}`
    } catch {
      return undefined
    }
  }
  return undefined
}

/** Ensure admin is authenticated; sets req.auth_context. Returns false if 401 was sent. */
function ensureAdminAuth(req: MedusaRequest, res: MedusaResponse): boolean {
  const bearer = getBearerFromRequest(req)
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig: { http: { jwtSecret: string; jwtPublicKey?: string; jwtOptions?: object } }
  }
  const http = config?.projectConfig?.http
  const jwtOptions = http && "jwtVerifyOptions" in http ? (http as any).jwtVerifyOptions : (http as any)?.jwtOptions
  const authContext =
    http && bearer
      ? getAuthContextFromJwtToken(bearer, http.jwtSecret, ["bearer"], ["user"], http.jwtPublicKey, jwtOptions)
      : null
  if (!authContext?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return false
  }
  ;(req as any).auth_context = authContext
  return true
}

async function refetchInvite(
  inviteId: string,
  scope: { resolve: (key: string) => unknown },
  fields: string[] | undefined
) {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (q: object) => Promise<{ rows: unknown[] }>
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "invite",
    variables: { filters: { id: inviteId } },
    fields: fields ?? [],
  })
  const result = await remoteQuery(queryObject)
  const rows = "rows" in result ? (result as { rows: unknown[] }).rows : (result as unknown[])
  return Array.isArray(rows) ? rows[0] : result
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!ensureAdminAuth(req, res)) return
  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY) as (q: object) => Promise<{ rows: unknown[]; metadata: { count: number; skip: number; take: number } }>
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "invite",
    variables: {
      filters: (req as any).filterableFields ?? {},
      ...(req as any).queryConfig?.pagination,
    },
    fields: (req as any).queryConfig?.fields ?? [],
  })
  const { rows: invites, metadata } = await remoteQuery(queryObject)
  res.json({
    invites: invites ?? [],
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 10,
  })
}

/**
 * POST /admin/invites - create invite with clearer error messages for GCP/cloud.
 * Wraps createInvitesWorkflow and maps common failures to explicit messages
 * so the UI does not show "An unknown error occurred."
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!ensureAdminAuth(req, res)) return
  const body = ((req as any).validatedBody ?? (req as any).body) as { email?: string }
  const email = body?.email?.trim()

  if (!email) {
    res.status(400).json({
      type: MedusaError.Types.INVALID_DATA,
      code: "invalid_data",
      message: "Email is required to send an invite.",
    })
    return
  }

  try {
    const workflow = createInvitesWorkflow(req.scope)
    const { result } = await workflow.run({
      input: { invites: [{ email }] },
    })
    const inviteId = result?.[0]?.id
    if (!inviteId) {
      res.status(500).json({
        type: "unknown_error",
        code: "unknown_error",
        message: "Invite was not created. Please try again.",
      })
      return
    }
    const queryConfig = (req as any).queryConfig
    const invite = await refetchInvite(inviteId, req.scope, queryConfig?.fields)
    res.status(200).json({ invite })
  } catch (err: any) {
    const message = err?.message ?? String(err)
    const type = err?.type ?? err?.name

    if (type === MedusaError.Types.DUPLICATE_ERROR || message.toLowerCase().includes("already exists") || message.toLowerCase().includes("duplicate")) {
      res.status(422).json({
        type: MedusaError.Types.DUPLICATE_ERROR,
        code: "duplicate_error",
        message: "An invite for this email already exists or the user is already registered.",
      })
      return
    }
    if (type === MedusaError.Types.NOT_ALLOWED || message.toLowerCase().includes("not allowed") || message.toLowerCase().includes("permission")) {
      res.status(403).json({
        type: MedusaError.Types.NOT_ALLOWED,
        code: "not_allowed",
        message: "You do not have permission to create invites. Check your role has invite create access.",
      })
      return
    }
    if (type === MedusaError.Types.INVALID_DATA) {
      res.status(400).json({
        type: MedusaError.Types.INVALID_DATA,
        code: "invalid_data",
        message: message || "Invalid invite data.",
      })
      return
    }

    res.status(500).json({
      type: "unknown_error",
      code: "unknown_error",
      message: message || "Failed to send invite. Check backend logs and CORS/backend URL if deployed on GCP.",
    })
  }
}
