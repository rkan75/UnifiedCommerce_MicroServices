import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function checkInvites({ container }: ExecArgs) {
  console.log("🔍 Checking user invites in database...\n")

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: {
        entity: string
        fields: string[]
        filters?: object
      }) => Promise<{ data: any[] }>
    }

    // Query invites using the invite entity
    const { data: invites } = await query.graph({
      entity: "invite",
      fields: ["id", "email", "accepted", "created_at", "updated_at"],
    })

    console.log(`✅ Found ${invites.length} invite(s):`)
    if (invites.length === 0) {
      console.log("   ⚠️  No invites found in database!")
    } else {
      invites.forEach((invite) => {
        console.log(`   - ${invite.email}`)
        console.log(`     ID: ${invite.id}`)
        console.log(`     Accepted: ${invite.accepted ? "Yes" : "No"}`)
        console.log(`     Created: ${invite.created_at}`)
        if (invite.updated_at) {
          console.log(`     Updated: ${invite.updated_at}`)
        }
        console.log("")
      })
    }

    // Also try to query directly from user module if available
    try {
      const userService = container.resolve("user") as {
        listInvites?: (filters?: object) => Promise<any[]>
      }
      
      if (userService.listInvites) {
        const invitesFromService = await userService.listInvites({})
        console.log(`\n✅ Found ${invitesFromService.length} invite(s) via User service`)
      }
    } catch (err) {
      // User service might not have listInvites method, that's okay
    }

    // Check which invites have corresponding users
    try {
      const { data: allUsers } = await query.graph({
        entity: "user",
        fields: ["id", "email", "created_at"],
      })
      
      console.log(`\n✅ Found ${allUsers.length} user(s) in user table:`)
      if (allUsers.length > 0) {
        allUsers.forEach((u: any) => {
          console.log(`   - ${u.email} (ID: ${u.id}, Created: ${u.created_at})`)
        })
      }
      
      console.log(`\n📊 Invite Status vs User Accounts:`)
      invites.forEach((invite) => {
        const userExists = allUsers.some((u: any) => 
          u.email?.toLowerCase() === invite.email?.toLowerCase()
        )
        const matchingUser = allUsers.find((u: any) => 
          u.email?.toLowerCase() === invite.email?.toLowerCase()
        )
        
        if (invite.accepted) {
          if (userExists) {
            console.log(`   ✓ ${invite.email} - Invite ACCEPTED, User account EXISTS`)
          } else {
            console.log(`   ⚠️  ${invite.email} - Invite marked ACCEPTED but NO user account found!`)
            console.log(`      This might indicate an issue with the acceptance flow.`)
          }
        } else {
          if (userExists) {
            console.log(`   ⚠️  ${invite.email} - Invite PENDING but User account EXISTS`)
            console.log(`      User may have been created through another method.`)
          } else {
            console.log(`   ✗ ${invite.email} - Invite PENDING, No user account yet`)
          }
        }
      })
    } catch (err) {
      console.error("Error checking users:", err instanceof Error ? err.message : err)
    }

    console.log("\n✅ Invite check complete!")
    console.log("\n💡 Table name: The invites are stored in the 'invite' table (entity name)")
    console.log("   You can query it directly: SELECT * FROM invite;")
    console.log("\n📝 Important: Users are created in the 'user' table ONLY when invites are accepted!")
    console.log("   Sending an invite does NOT create a user - only accepting the invite does.")
  } catch (err) {
    console.error("❌ Error querying invites:", err instanceof Error ? err.message : err)
    console.error("\n💡 The invites are stored in the 'invite' table")
  }
}
