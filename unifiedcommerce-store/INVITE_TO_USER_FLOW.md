# How Invites Create Users - Complete Flow

## Overview

When an invite is sent, **the user table is NOT immediately updated**. The user is only created when the invite is **accepted**. Here's the complete flow:

## Step-by-Step Flow

### Step 1: Invite is Sent (No User Created Yet)

**Action:** Admin sends invite via `/admin/invites` POST endpoint

**What Happens:**
1. ✅ Invite record is created in `invite` table:
   - `id`: Unique invite ID
   - `email`: Invitee's email address
   - `accepted`: `false`
   - `token`: Invite token
   - `expires_at`: Expiration timestamp
   - `created_at`: Creation timestamp

2. ❌ **No user is created yet** - User table remains unchanged

**Database State:**
```sql
-- invite table
INSERT INTO invite (id, email, accepted, token, expires_at, created_at)
VALUES ('invite_123', 'user@example.com', false, 'token_xyz', '2026-02-10', NOW());

-- user table
-- (No changes - user doesn't exist yet)
```

### Step 2: User Receives Email (Still No User)

**Action:** Email is sent with invite link (if SendGrid/notification provider configured)

**What Happens:**
- Email contains invite acceptance link
- Link format: `http://your-admin-url/invites/accept?token=<invite_token>`
- ❌ **User table still not updated**

### Step 3: User Accepts Invite (User Created!)

**Action:** User clicks invite link and completes registration

**Process:**

1. **User registers/auth identity is created:**
   - Endpoint: `POST /auth/user/emailpass/register`
   - Body: `{ "email": "user@example.com", "password": "password123" }`
   - Creates an **auth identity** (not a user yet)

2. **User accepts invite:**
   - Endpoint: `POST /admin/invites/accept`
   - Body: `{ "token": "<invite_token>", "user": { "email": "...", "first_name": "...", "last_name": "..." } }`
   - Headers: `Authorization: Bearer <registration_jwt_token>`

3. **`acceptInviteWorkflow` runs:**
   ```typescript
   // Workflow steps:
   1. validateTokenStep() - Validates the invite token
   2. createUsersWorkflow() - Creates user in user table ✅
   3. setAuthAppMetadataStep() - Links auth identity to user
   4. deleteInvitesStep() - Marks invite as accepted (or deletes it)
   5. emitEventStep() - Emits invite.accepted event
   ```

**Database State After Acceptance:**
```sql
-- user table (NEW ROW CREATED)
INSERT INTO "user" (id, email, first_name, last_name, created_at, updated_at)
VALUES ('user_456', 'user@example.com', 'John', 'Doe', NOW(), NOW());

-- invite table (UPDATED)
UPDATE invite 
SET accepted = true, updated_at = NOW()
WHERE id = 'invite_123';

-- auth_identity table (LINKED)
-- Links the auth identity created in step 3.1 to the new user
```

## Key Points

### ✅ When Invite is Sent:
- **invite table**: New row created with `accepted = false`
- **user table**: **NO CHANGES** (user doesn't exist yet)

### ✅ When Invite is Accepted:
- **user table**: **NEW USER CREATED** ✅
- **invite table**: `accepted` field updated to `true`
- **auth_identity table**: Linked to the new user

## Database Tables Involved

1. **`invite` table** - Stores pending invites
   - Created when invite is sent
   - Updated when invite is accepted

2. **`user` table** - Stores admin users
   - **Created only when invite is accepted**
   - Contains: id, email, first_name, last_name, etc.

3. **`auth_identity` table** - Stores authentication credentials
   - Created during registration (before accepting invite)
   - Linked to user when invite is accepted

## Workflow Details

The `acceptInviteWorkflow` performs these operations:

```typescript
acceptInviteWorkflow({
  input: {
    invite_token: "invite_token_from_email",
    auth_identity_id: "auth_identity_id_from_registration",
    user: {
      email: "user@example.com",
      first_name: "John",
      last_name: "Doe"
    }
  }
})
```

**What it does:**
1. Validates invite token
2. **Creates user** using `createUsersWorkflow`
3. Links auth identity to user
4. Marks invite as accepted
5. Emits `invite.accepted` event

## Checking Invite Status

You can check invite status using the script:

```bash
npx medusa exec ./src/scripts/check-invites.ts
```

This shows:
- All invites (accepted and pending)
- Which invites have been accepted (`accepted: true`)
- Which users were created from accepted invites

## Summary

**TL;DR:**
- ❌ **Sending an invite** → Only creates record in `invite` table
- ✅ **Accepting an invite** → Creates user in `user` table

The user table is updated **only when the invite is accepted**, not when it's sent!
