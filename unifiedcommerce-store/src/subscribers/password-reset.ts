import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

type PasswordResetEventData = {
  entity_id: string
  actor_type: string
  token: string
  metadata?: Record<string, unknown>
}

/**
 * Subscriber that sends the password reset email to customers when they request
 * a reset from the storefront. Uses the same SendGrid notification provider as
 * invite emails. Only sends for actor_type "customer"; admin resets are handled
 * by the admin UI.
 */
export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData | PasswordResetEventData[]>) {
  const payload = Array.isArray(data) ? data[0] : data
  if (!payload?.entity_id || !payload?.token) {
    console.warn("📧 auth.password_reset event missing entity_id or token:", payload)
    return
  }

  // Only send storefront reset emails for customers
  if (payload.actor_type !== "customer") {
    return
  }

  const email = payload.entity_id
  const token = payload.token

  let notificationModule
  try {
    notificationModule = container.resolve(Modules.NOTIFICATION)
  } catch (err) {
    console.error("❌ Password reset: Notification module not available (SendGrid may be unconfigured):", err)
    return
  }

  // Storefront URL for the reset link (same env pattern as MEDUSA_ADMIN_URL for invites)
  const storefrontUrl = (
    process.env.MEDUSA_STOREFRONT_URL ||
    process.env.STOREFRONT_URL ||
    process.env.STORE_CORS?.split(",")[0]?.trim() ||
    "http://localhost:8000"
  ).replace(/\/$/, "")

  // Storefront expects: /{countryCode}/account/reset-password?token=...&email=...
  const defaultCountryCode = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"
  const resetUrl = `${storefrontUrl}/${defaultCountryCode}/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  const notificationData = {
    to: email,
    channel: "email",
    template: null,
    data: {
      email,
      token,
      reset_url: resetUrl,
    },
    content: {
      subject: "Reset your password",
      html: `
        <h2>Reset your password</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
      `,
      text: `Reset your password: ${resetUrl}. This link expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    },
    trigger_type: "auth.password_reset",
    resource_type: "auth",
    resource_id: email,
  }

  try {
    await notificationModule.createNotifications(notificationData)
    console.log(`✅ Password reset email sent to: ${email}`)
  } catch (err) {
    console.error("❌ Error sending password reset email:", err)
    throw err
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
