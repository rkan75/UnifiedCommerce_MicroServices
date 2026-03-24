# Password Reset for Admin Users

## Overview

Medusa v2 provides password reset functionality for admin users. The process involves:

1. **Request Password Reset** - User requests a password reset token
2. **Receive Email** - User receives an email with reset link (requires notification provider)
3. **Reset Password** - User clicks link and sets new password

## Password Reset Flow

### Step 1: Request Password Reset Token

**Endpoint:** `POST /auth/user/emailpass/reset-password`

**Request Body:**
```json
{
  "identifier": "user@example.com"
}
```

**Example using cURL:**
```bash
curl -X POST http://localhost:9000/auth/user/emailpass/reset-password \
  -H "Content-Type: application/json" \
  -d '{"identifier": "user@example.com"}'
```

**Using Medusa JS SDK:**
```typescript
import { sdk } from "@medusajs/js-sdk"

await sdk.auth.resetPassword("user", "emailpass", {
  identifier: "user@example.com"
})
```

**What happens:**
- Medusa generates a password reset token (JWT)
- Emits `auth.password_reset` event
- Returns 201 status (always succeeds to prevent email enumeration)
- **Email is sent** if notification provider is configured (SendGrid, etc.)

### Step 2: User Receives Email

If SendGrid (or another notification provider) is configured, the user will receive an email with:
- Reset password link containing the token
- Link format: `http://your-admin-url/reset-password?token=<reset_token>`

The token is a JWT that contains:
- `entity_id`: The user's email
- `provider`: "emailpass"
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp

### Step 3: Reset Password

**Endpoint:** `POST /auth/user/emailpass/update`

**Request Body:**
```json
{
  "password": "new_password_here"
}
```

**Headers:**
```
Authorization: Bearer <reset_token_from_email>
```

**Example using cURL:**
```bash
curl -X POST http://localhost:9000/auth/user/emailpass/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "password": "newSecurePassword123"
  }'
```

**Using Medusa JS SDK:**
```typescript
import { sdk } from "@medusajs/js-sdk"

await sdk.auth.updateProvider("user", "emailpass", {
  password: "newSecurePassword123"
}, resetToken)
```

## Current Status

✅ **Password reset API is available** - The endpoints exist and work
⚠️ **Email notifications** - Requires SendGrid (or other notification provider) to be configured

## How Users Can Reset Password

### Option 1: Via Admin UI (Built-in)

**Medusa Admin Dashboard has a built-in password reset page!**

1. **Go to the login page**: `http://localhost:9000/app/login`
2. **Click "Forgot Password"** link (should be visible on the login page)
3. **Or navigate directly to**: `http://localhost:9000/app/reset-password`
4. **Enter your email address** and click "Send Reset Instructions"
5. **Check your email** for the reset link (requires SendGrid/notification provider)
6. **Click the link** in the email (contains token in URL)
7. **Enter new password** and confirm
8. **Login** with your new password

**The reset password page URL format:**
- Request reset: `http://localhost:9000/app/reset-password`
- Reset with token: `http://localhost:9000/app/reset-password?token=<jwt_token>`

### Option 2: Via API (Programmatic)

**Request Password Reset:**
```bash
curl -X POST http://localhost:9000/auth/user/emailpass/reset-password \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@medusa-test.com"}'
```

**Reset Password with Token:**
```bash
curl -X POST http://localhost:9000/auth/user/emailpass/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <reset_token>" \
  -d '{"password": "newPassword123"}'
```

### Option 3: Manual Reset (Admin Only)

As an admin, you can manually reset a user's password using the Medusa CLI or by updating the user directly in the database (not recommended for production).

## Testing Password Reset

### Without Email (Local Development)

1. **Request reset token:**
   ```bash
   curl -X POST http://localhost:9000/auth/user/emailpass/reset-password \
     -H "Content-Type: application/json" \
     -d '{"identifier": "admin@medusa-test.com"}'
   ```

2. **Check backend logs** - The reset token will be logged (if logging is enabled)

3. **Use the token** to reset password via the update endpoint

### With Email (Production)

Once SendGrid is configured:
1. User clicks "Forgot Password" on admin login page
2. Enters their email address
3. Receives email with reset link
4. Clicks link and sets new password

## Important Notes

- **Email Required**: For production use, a notification provider (SendGrid) must be configured
- **Token Expiration**: Reset tokens typically expire after a set time (check Medusa config)
- **Security**: The reset-password endpoint always returns 201 to prevent email enumeration attacks
- **Actor Type**: For admin users, use `actor_type=user` and `auth_provider=emailpass`

## Built-in Admin UI

✅ **Good News!** Medusa Admin Dashboard already includes a password reset page at `/reset-password`.

The login page should have a "Forgot Password" link that navigates to this page. If you don't see it, you can:

1. **Navigate directly**: Go to `http://localhost:9000/app/reset-password`
2. **Add a link manually**: If needed, add a link to your custom admin login page pointing to `/reset-password`

## Email Notification Setup

For users to receive password reset emails, you need:

1. **SendGrid configured** (see `EMAIL_SETUP.md`)
2. **Notification provider** set up in `medusa-config.ts`
3. **Event subscriber** to handle `auth.password_reset` event and send email

The `auth.password_reset` event is emitted when a reset token is generated. You can create a subscriber to send the email with the reset link.

## Related Files

- Password reset route: `/node_modules/@medusajs/medusa/dist/api/auth/[actor_type]/[auth_provider]/reset-password/route.js`
- Update password route: `/node_modules/@medusajs/medusa/dist/api/auth/[actor_type]/[auth_provider]/update/route.js`
- Email configuration: See `EMAIL_SETUP.md`
