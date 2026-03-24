import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Subscriber that sends email notifications when invites are created
 * 
 * This subscriber listens to the "invite.created" event and sends
 * an email to the invitee with a link to accept the invite.
 */
export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  console.log("📧 Invite created event received:", data)

  try {
    // Resolve notification module service
    const notificationModule = container.resolve(Modules.NOTIFICATION)
    
    // Resolve query service to fetch invite details
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: {
        entity: string
        fields: string[]
        filters?: object
      }) => Promise<{ data: any[] }>
    }

    // Normalize data to array - handle both single object and array
    const inviteDataArray = Array.isArray(data) ? data : [data]

    // Process each invite in the event data
    for (const inviteData of inviteDataArray) {
      try {
        // Fetch invite details from database
        const { data: invites } = await query.graph({
          entity: "invite",
          fields: ["id", "email", "token", "expires_at"],
          filters: { id: inviteData.id },
        })

        if (!invites || invites.length === 0) {
          console.error(`❌ Invite not found: ${inviteData.id}`)
          continue
        }

        const invite = invites[0]
        console.log(`📨 Sending invite email to: ${invite.email}`)

        // Get admin frontend URL from environment
        // MEDUSA_ADMIN_URL should point to the admin frontend (e.g., http://localhost:9000)
        // If not set, use the first ADMIN_CORS value that contains port 9000, or fallback to localhost:9000
        const adminFrontendUrl = process.env.MEDUSA_ADMIN_URL || 
          process.env.ADMIN_CORS?.split(",").find(url => url.includes(":9000"))?.trim() ||
          process.env.ADMIN_CORS?.split(",")[0]?.trim() || 
          "http://localhost:9000"
        
        // Medusa Admin frontend route for accepting invites
        // The route is /app/invite in Medusa Admin (admin UI is served under /app prefix)
        const inviteAcceptUrl = `${adminFrontendUrl}/app/invite?token=${invite.token}`
        
        console.log(`🔗 Invite acceptance URL: ${inviteAcceptUrl}`)

        // Prepare notification data
        const notificationData = {
          to: invite.email,
          channel: "email",
          template: null, // Set to null to use content instead of SendGrid template
          data: {
            email: invite.email,
            token: invite.token,
            invite_accept_url: inviteAcceptUrl,
            expires_at: invite.expires_at,
          },
          content: {
            subject: "You've been invited to join the admin team",
            html: `
              <h2>You've been invited!</h2>
              <p>You've been invited to join the admin team. Click the link below to accept your invitation:</p>
              <p><a href="${inviteAcceptUrl}">Accept Invitation</a></p>
              <p>Or copy and paste this URL into your browser:</p>
              <p>${inviteAcceptUrl}</p>
              <p>This invitation will expire on ${new Date(invite.expires_at).toLocaleString()}.</p>
            `,
            text: `You've been invited to join the admin team. Click this link to accept: ${inviteAcceptUrl}. This invitation expires on ${new Date(invite.expires_at).toLocaleString()}.`,
          },
          trigger_type: "invite.created",
          resource_type: "invite",
          resource_id: invite.id,
        }

        console.log(`📤 Calling notificationModule.createNotifications with:`, {
          to: notificationData.to,
          channel: notificationData.channel,
          hasContent: !!notificationData.content,
          hasTemplate: !!notificationData.template,
        })

        // Create notification to send email
        const result = await notificationModule.createNotifications(notificationData)

        console.log(`📬 Notification creation result:`, {
          id: result?.id,
          status: result?.status,
          channel: result?.channel,
          provider_id: result?.provider_id,
        })

        console.log(`✅ Invite email sent successfully to: ${invite.email}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isNoProvider = /notification provider.*channel.*email/i.test(message) || /Could not find a notification provider/i.test(message)
        const isUnverifiedSender = /403|verified.*sender|sender identity/i.test(message) || /from address does not match/i.test(message)
        if (isNoProvider) {
          const baseUrl = process.env.MEDUSA_ADMIN_URL || "http://localhost:9000"
          console.warn(
            `⚠️  Invite created (${inviteData.id}), but email was not sent: no email provider configured. ` +
            `Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env to send invite emails. ` +
            `Accept URL format: ${baseUrl}/app/invite?token=<token> (get token from invite in DB).`
          )
        } else if (isUnverifiedSender) {
          const fromEmail = process.env.SENDGRID_FROM_EMAIL || "(see .env SENDGRID_FROM_EMAIL)"
          console.warn(
            `⚠️  Invite created (${inviteData.id}), but email was not sent: the From address (${fromEmail}) is not verified in SendGrid. ` +
            `Verify it at https://app.sendgrid.com/settings/sender_auth (Single Sender Verification or Domain Authentication). ` +
            `Until then, share the invite link from the database or logs.`
          )
        } else {
          console.error(`❌ Error sending invite email for ${inviteData.id}:`, err)
        }
        // Do not rethrow: invite was created successfully; only the notification failed
      }
    }
  } catch (err) {
    console.error("❌ Error in invite created subscriber:", err)
    throw err // Re-throw to let Medusa handle retry logic
  }
}

export const config: SubscriberConfig = {
  event: "invite.created",
}
