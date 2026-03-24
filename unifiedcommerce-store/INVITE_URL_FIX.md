# Invite URL Fix - "Cannot GET /invite" Error

## Problem

When clicking the invite link in the email, you get:
```
Cannot GET /invite
```

## Root Cause

The invite URL in the email might be pointing to `/invite` instead of `/app/invite`. Medusa Admin routes are served under the `/app` prefix.

## Solution

The code has been updated to use `/app/invite`. However, if you're seeing this error, it means:

1. **You're using an OLD invite email** - The invite was sent before the code fix
2. **Backend needs restart** - The subscriber needs to reload to use the new URL format

## Steps to Fix

### 1. Restart Your Backend

The subscriber code change requires a backend restart:

```bash
# Stop current backend (Ctrl+C)
# Then restart:
npm run dev
```

### 2. Send a NEW Invite

**Important:** You must send a NEW invite after restarting. Old invites will still have the wrong URL.

1. Go to User & Role Management page
2. Enter the email address
3. Click "Send Invite"
4. Check backend logs for the invite URL:
   ```
   🔗 Invite acceptance URL: http://localhost:9000/app/invite?token=...
   ```

### 3. Verify the URL Format

The correct invite URL should be:
```
http://localhost:9000/app/invite?token=<invite_token>
```

NOT:
```
http://localhost:9000/invite?token=<invite_token>  ❌ Wrong!
```

## Testing

1. **Check if admin is accessible:**
   - Open `http://localhost:9000/app` in your browser
   - You should see the Medusa Admin login page

2. **Test invite route directly:**
   - Try accessing `http://localhost:9000/app/invite` (without token)
   - You should see the invite acceptance page (may show an error about missing token, but the route should exist)

3. **Send new invite and test:**
   - Send a new invite
   - Click the link in the email
   - It should go to `/app/invite?token=...` and work correctly

## Current Configuration

The subscriber is configured to generate:
```typescript
const inviteAcceptUrl = `${adminFrontendUrl}/app/invite?token=${invite.token}`
```

Where `adminFrontendUrl` is:
- `MEDUSA_ADMIN_URL` from `.env` (currently `http://localhost:9000`)
- Or falls back to `http://localhost:9000`

## If Still Not Working

1. **Check backend logs** when sending invite - look for:
   ```
   🔗 Invite acceptance URL: ...
   ```
   Verify it shows `/app/invite`

2. **Check the actual email** - Open the email and verify the link contains `/app/invite`

3. **Verify admin path** - Check if your admin is actually served at `/app`:
   - Try `http://localhost:9000/app` - should show admin login
   - Try `http://localhost:9000/app/invite` - should show invite page (may error about token)

4. **Check admin configuration** - Verify `medusa-config.ts` doesn't override the admin path

## Summary

- ✅ Code is fixed to use `/app/invite`
- ⏳ **Restart backend** (required!)
- ⏳ **Send NEW invite** (old invites won't work)
- ✅ Test the new invite link
