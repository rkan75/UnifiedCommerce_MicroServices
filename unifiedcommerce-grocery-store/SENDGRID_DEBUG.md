# SendGrid Debugging Guide

## Issue: SendGrid Not Receiving Requests

If SendGrid is not receiving requests, follow these debugging steps:

## 1. Verify Configuration

### Check `.env` file:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx  # Must start with SG.
SENDGRID_FROM_EMAIL=your-verified-email@domain.com  # Must be verified in SendGrid
```

### Check `medusa-config.ts`:
- SendGrid provider is configured with `channels: ["email"]`
- API key and from email are set correctly

## 2. Check Backend Logs

When sending an invite, you should see:
```
📧 Invite created event received: { id: '...' }
📨 Sending invite email to: user@example.com
📤 Calling notificationModule.createNotifications with: { to: '...', channel: 'email', ... }
📬 Notification creation result: { id: '...', status: '...', provider_id: '...' }
✅ Invite email sent successfully to: user@example.com
```

## 3. Verify SendGrid Provider is Loaded

Check backend startup logs for:
```
✅ SendGrid notification provider configured successfully
   From email: your-email@domain.com
   API key: SG.HDnIBHr...rx_8
```

## 4. Check Notification Status in Database

The notification module stores notifications in the database. Check if notifications are being created:

```bash
# Run this script to check notifications
npx medusa exec ./src/scripts/check-notifications.ts
```

## 5. Common Issues

### Issue: Template vs Content Conflict

**Problem:** If you set both `template` and `content`, SendGrid will use content if it exists, but if template is set to a non-existent template ID, it might cause issues.

**Solution:** Set `template: null` when using `content`:

```typescript
await notificationModule.createNotifications({
  to: invite.email,
  channel: "email",
  template: null, // ← Set to null when using content
  content: {
    subject: "...",
    html: "...",
  },
})
```

### Issue: Provider Not Found for Channel

**Error:** `Could not find a notification provider for channel: email`

**Solution:** Ensure `channels: ["email"]` is set in provider options:

```typescript
options: {
  api_key: sendGridApiKey,
  from: sendGridFromEmail,
  channels: ["email"], // ← Required!
}
```

### Issue: SendGrid API Key Invalid

**Error:** `Failed to send email: 401 - unauthorized`

**Solution:**
- Verify API key is correct
- Check API key has "Mail Send" permissions in SendGrid dashboard
- Ensure API key starts with `SG.`

### Issue: From Email Not Verified

**Error:** `Failed to send email: 403 - The from address does not match a verified Sender Identity`

**Solution:**
- Verify sender email in SendGrid dashboard
- Go to Settings → Sender Authentication
- Verify single sender or domain

## 6. Test SendGrid Connection Directly

Create a test script to verify SendGrid is working:

```typescript
// test-sendgrid.ts
import * as sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

const msg = {
  to: 'test@example.com',
  from: process.env.SENDGRID_FROM_EMAIL!,
  subject: 'Test Email',
  html: '<p>This is a test email</p>',
}

sgMail.send(msg)
  .then(() => console.log('✅ Email sent successfully'))
  .catch((error) => console.error('❌ Error:', error))
```

## 7. Check SendGrid Dashboard

1. Log into SendGrid dashboard
2. Go to **Activity** → **Email Activity**
3. Check if emails are being sent
4. Look for any bounces, blocks, or errors

## 8. Enable Detailed Logging

The subscriber now includes detailed logging. Check backend logs for:
- Notification creation request details
- Notification creation result
- Any errors from SendGrid provider

## Next Steps

1. **Restart backend** after any configuration changes
2. **Send a test invite** and check logs
3. **Verify in SendGrid dashboard** that the request was received
4. **Check recipient's inbox** (and spam folder)
