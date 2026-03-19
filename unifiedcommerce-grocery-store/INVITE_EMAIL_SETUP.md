# Invite Email Setup - Complete Guide

## Problem

After clicking "Send Invite" in the admin UI, you see a success message, but:
- ❌ No email is received by the recipient
- ❓ Not sure if SendGrid is integrated
- ❓ Not sure if the email is being invoked

## Root Cause

**Medusa v2 does NOT automatically send emails when invites are created.** Even though:
- ✅ SendGrid is configured in `medusa-config.ts`
- ✅ The invite is created successfully in the database
- ✅ The `invite.created` event is emitted

**You need a custom subscriber** to listen to the `invite.created` event and send the email via the Notification Module.

## Solution

A subscriber has been created at `src/subscribers/invite-created.ts` that:
1. Listens to the `invite.created` event
2. Fetches invite details (email, token)
3. Sends email via SendGrid using the Notification Module

## Verification Steps

### 1. Check SendGrid Configuration

Verify your `.env` file has:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=your-verified-email@domain.com
```

### 2. Verify `medusa-config.ts`

Ensure SendGrid notification provider is configured:
```typescript
config.modules.push({
  resolve: "@medusajs/medusa/notification",
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/notification-sendgrid",
        id: "sendgrid",
        options: {
          api_key: process.env.SENDGRID_API_KEY,
          from: process.env.SENDGRID_FROM_EMAIL,
        },
      },
    ],
  },
})
```

### 3. Restart Backend

**IMPORTANT:** After creating the subscriber, you MUST restart your Medusa backend:

```bash
# Stop the current backend (Ctrl+C)
# Then restart:
npm run dev
# or
npx medusa start
```

### 4. Test Invite Email

1. Go to User & Role Management page
2. Enter an email address
3. Click "Send Invite"
4. Check backend logs for:
   ```
   📧 Invite created event received: [...]
   📨 Sending invite email to: user@example.com
   ✅ Invite email sent successfully to: user@example.com
   ```

### 5. Check SendGrid Dashboard

- Log into SendGrid dashboard
- Go to Activity → Email Activity
- You should see the email being sent
- Check for any bounces or blocks

## Troubleshooting

### No Email Received

1. **Check Backend Logs:**
   ```bash
   # Look for these messages:
   📧 Invite created event received
   📨 Sending invite email to: ...
   ✅ Invite email sent successfully
   ```

2. **Check for Errors:**
   ```bash
   # Look for:
   ❌ Error sending invite email
   ❌ Error in invite created subscriber
   ```

3. **Verify SendGrid:**
   - Check SendGrid API key is valid
   - Verify sender email is verified in SendGrid
   - Check SendGrid Activity dashboard for delivery status

4. **Check Spam Folder:**
   - Emails might be going to spam
   - Check spam/junk folder

5. **Verify Subscriber is Loaded:**
   - Check backend startup logs for:
     ```
     Loading subscriber: invite-created
     ```
   - If not shown, the subscriber might not be loading

### Common Issues

#### Issue: "Subscriber not found" or no email sent

**Solution:**
- Ensure `src/subscribers/invite-created.ts` exists
- Restart backend after creating subscriber
- Check file exports `config` with `event: "invite.created"`

#### Issue: "Notification module not found"

**Solution:**
- Verify Notification module is configured in `medusa-config.ts`
- Check SendGrid provider is properly configured
- Restart backend

#### Issue: "SendGrid API error"

**Solution:**
- Verify `SENDGRID_API_KEY` is correct
- Check API key has "Mail Send" permissions
- Verify sender email (`SENDGRID_FROM_EMAIL`) is verified in SendGrid

#### Issue: Email sent but not received

**Solution:**
- Check SendGrid Activity dashboard
- Verify recipient email is valid
- Check spam folder
- Verify sender domain is not blacklisted

## How It Works

### Flow Diagram

```
1. Admin clicks "Send Invite"
   ↓
2. POST /admin/invites API called
   ↓
3. createInvitesWorkflow runs
   ↓
4. Invite saved to database
   ↓
5. Event "invite.created" emitted
   ↓
6. invite-created.ts subscriber triggered
   ↓
7. Subscriber fetches invite details
   ↓
8. Subscriber calls Notification Module
   ↓
9. SendGrid sends email
   ↓
10. Email received by recipient
```

### Event Payload

The `invite.created` event contains:
```typescript
{
  data: [
    { id: "invite_123" },
    { id: "invite_456" }, // Multiple invites can be created at once
  ]
}
```

The subscriber:
1. Receives the event with invite IDs
2. Queries the database for invite details (email, token)
3. Constructs the invite acceptance URL
4. Sends email via Notification Module

## Email Content

The subscriber sends an email with:
- **Subject:** "You've been invited to join the admin team"
- **Body:** HTML and plain text versions
- **Link:** Invite acceptance URL with token
- **Expiration:** When the invite expires

You can customize the email template in `src/subscribers/invite-created.ts`.

## Next Steps

1. ✅ Subscriber created (`src/subscribers/invite-created.ts`)
2. ✅ SendGrid configured (`medusa-config.ts`)
3. ⏳ **Restart backend** (REQUIRED!)
4. ⏳ Test sending an invite
5. ⏳ Verify email received

## Summary

**The issue:** Medusa doesn't automatically send invite emails - you need a subscriber.

**The fix:** Created `src/subscribers/invite-created.ts` to handle email sending.

**Action required:** Restart your backend to load the subscriber!
