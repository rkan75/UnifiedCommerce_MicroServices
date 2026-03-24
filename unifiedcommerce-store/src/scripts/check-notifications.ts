import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function checkNotifications({ container }: ExecArgs) {
  console.log("🔍 Checking notifications in database...\n")

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: {
        entity: string
        fields: string[]
        filters?: object
      }) => Promise<{ data: any[] }>
    }

    // Query notifications
    const { data: notifications } = await query.graph({
      entity: "notification",
      fields: [
        "id",
        "to",
        "channel",
        "status",
        "created_at",
        "updated_at",
        "provider_id",
        "trigger_type",
        "resource_type",
        "resource_id",
      ],
    })

    console.log(`✅ Found ${notifications.length} notification(s):`)
    if (notifications.length === 0) {
      console.log("   ⚠️  No notifications found in database!")
    } else {
      notifications.forEach((notif: any) => {
        console.log(`   - Notification ID: ${notif.id}`)
        console.log(`     To: ${notif.to}`)
        console.log(`     Channel: ${notif.channel}`)
        console.log(`     Status: ${notif.status}`)
        console.log(`     Provider ID: ${notif.provider_id || "N/A"}`)
        console.log(`     Trigger: ${notif.trigger_type}`)
        console.log(`     Created: ${notif.created_at}`)
        if (notif.updated_at) {
          console.log(`     Updated: ${notif.updated_at}`)
        }
        console.log("")
      })
    }

    // Also check notification providers
    try {
      const notificationModule = container.resolve(Modules.NOTIFICATION)
      const providers = await (notificationModule as any).listNotificationProviders?.({}) ?? []
      
      console.log(`\n✅ Found ${providers.length} notification provider(s):`)
      providers.forEach((provider: any) => {
        console.log(`   - ${provider.id} (${provider.name})`)
        console.log(`     Enabled: ${provider.is_enabled ? "Yes" : "No"}`)
        console.log(`     Channels: ${provider.channels?.join(", ") || "None"}`)
        console.log("")
      })
    } catch (err) {
      console.error("Error checking providers:", err instanceof Error ? err.message : err)
    }

    console.log("\n✅ Notification check complete!")
  } catch (err) {
    console.error("❌ Error querying notifications:", err instanceof Error ? err.message : err)
  }
}
