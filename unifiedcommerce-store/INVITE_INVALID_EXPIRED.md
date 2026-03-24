# "The invite is invalid or has expired"

This message appears when accepting an invite fails because the invite link is no longer valid.

## Causes

1. **Invite expired** – Invites are valid for **24 hours** by default. If the link is older than that, the server rejects it.
2. **Invite already accepted** – The invite was already used. Each link can only be used once.
3. **Wrong or corrupted token** – The link was truncated, modified, or the token was not sent correctly (e.g. missing `?token=...` in the URL).
4. **Email mismatch** – You’re signed in with a different email than the one the invite was sent to. Use the email that received the invite, or sign out and use the invite link again.

## What to do

- **Expired:** Ask an admin to send a **new invite** from the User & Role Management (or Users) page. Use the new link within 24 hours.
- **Already accepted:** If you already completed the invite, log in at the admin login page. You don’t need to use the link again.
- **Wrong email:** Use the account that received the invite, or open the invite link in a private/incognito window and complete the form with that email.
- **Broken link:** Ensure the full URL is used, including the `token=...` part (e.g. `http://localhost:9000/app/invite?token=eyJ...`).

## Technical note

The custom accept route in this project returns **400** with this message when token validation fails (expired, invalid, or invite not found), so the admin UI can show the same message in all these cases.
