# Invite: "Server error try again" / "Identity with email already exists"

## What you see

When accepting an invite by **creating an account** on the invite page, you may see:

- **UI:** "Server error try again"
- **Server log:** `info: Identity with email already exists` and `POST /auth/user/emailpass/register (401)`

## Why it happens

The invite flow expects you to **register** first (create a new auth identity), then **accept** the invite. If an auth identity for that email **already exists** (e.g. you already signed up or accepted an invite before), the register call returns **401** with "Identity with email already exists". The UI then shows a generic "Server error try again".

## What to do

### Fixed in this project: register when email already exists

A **custom register route** in this project fixes the 401 when an account with that email already exists:

- **Route:** `POST /auth/user/emailpass/register` (see `src/api/auth/[actor_type]/[auth_provider]/register/route.ts`).
- **Behavior:** If the auth provider returns "Identity with email already exists", the route tries to **log you in** with the same email and password. If login succeeds, it returns **200 with a token** (same as a normal registration). You can then complete the invite flow without seeing "Server error try again".
- **Result:** On the invite page, submit the form with your **existing** email and password. You get a token and the accept-invite step runs; with the custom accept route, the invite is accepted for your existing user.

So you can use the invite page as usual: if the email already has an account, use that account’s password and submit; you should no longer get 401.

### Option 1: You already have an account – accept via API (fallback)

If you already have an admin account with that email, the backend can accept the invite for your existing user (no new account). The default Medusa Admin invite page always tries **register** first, so even after you sign in and open the invite link again, submitting the form will still try register and get 401. So use **Option 2** below to accept the invite while logged in.

### Option 2: Accept invite via API (when already logged in)

If you are already logged in and the invite email matches your account:

1. Log in to the admin (so you have a valid session/bearer token).
2. Call the accept endpoint with the invite token (e.g. from the invite URL `?token=...`):

```bash
# Replace ADMIN_URL and TOKEN with your values (e.g. http://localhost:9000 and the token from the invite link)
curl -X POST "$ADMIN_URL/admin/invites/accept?token=YOUR_INVITE_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -d '{"email":"your@email.com","first_name":"Your","last_name":"Name"}'
```

The custom route in this project allows an **already authenticated** user to accept an invite when the invite email matches their account email. The invite is marked accepted and no new user is created. To get your JWT: log in to the admin in the browser, then in DevTools → Application (or Network) find the session/token used for API requests (e.g. `Authorization: Bearer ...`).

### Option 3: Use a different email

If the invite was meant for a **new** person, send a new invite to a different email that has never been used for admin registration.

## Backend change in this project

A **custom** `POST /admin/invites/accept` route is implemented in:

- `src/api/admin/invites/accept/route.ts`

It:

- **When the user is not logged in (just registered):** Uses the default Medusa flow (create user, link auth identity, accept invite).
- **When the user is already logged in:** If the invite email matches the logged-in user’s email, it validates the token, marks the invite as accepted, emits `invite.accepted`, and returns the existing user (no duplicate account).

This allows "sign in first, then accept invite" for existing accounts.
