#!/usr/bin/env node
/**
 * Applies store branding to the Medusa admin dashboard after install:
 * - Welcome text: "Welcome to Medusa" -> "Welcome to GNC" (login + invite)
 * - Logo: Replace Medusa SVG with img pointing to /admin/logo (public/store-logo.png via GET /admin/logo)
 * - Invite accept: normalize auth_token when register returns { token } (avoid Bearer [object Object])
 * Run automatically from postinstall; can also run: node scripts/apply-admin-branding.js
 */

const fs = require("fs");
const path = require("path");

const dashboardRoot = path.join(
  __dirname,
  "..",
  "node_modules",
  "@medusajs",
  "dashboard"
);

const enJsonPath = path.join(dashboardRoot, "src", "i18n", "translations", "en.json");
const avatarBoxPath = path.join(dashboardRoot, "src", "components", "common", "logo-box", "avatar-box.tsx");
const invitesHookPath = path.join(dashboardRoot, "src", "hooks", "api", "invites.tsx");

/** Stock @medusajs/dashboard useAcceptInvite body (before patch). */
const INVITE_ACCEPT_OLD = `    mutationFn: (payload) => {
      const { auth_token, ...rest } = payload

      return sdk.admin.invite.accept(
        { invite_token: inviteToken, ...rest },
        {},
        {
          Authorization: \`Bearer \${auth_token}\`,
        }
      )
    },`;

const INVITE_ACCEPT_NEW = `    mutationFn: (payload) => {
      const { auth_token, ...rest } = payload
      // Register may return { token } - ensure Bearer value is a string, not "[object Object]"
      const tokenStr =
        typeof auth_token === "string"
          ? auth_token
          : auth_token &&
              typeof auth_token === "object" &&
              auth_token !== null &&
              "token" in auth_token &&
              typeof auth_token.token === "string"
            ? auth_token.token
            : auth_token

      return sdk.admin.invite.accept(
        { invite_token: inviteToken, ...rest },
        {},
        typeof tokenStr === "string" && tokenStr
          ? { Authorization: \`Bearer \${tokenStr}\` }
          : {}
      )
    },`;

const WELCOME_OLD = '"title": "Welcome to Medusa"';
const WELCOME_NEW = '"title": "Welcome to GNC"';
/** Legacy welcome from older branding runs — migrate to GNC on next postinstall */
const WELCOME_LEGACY = '"title": "Welcome to TCS Unified AI Commerce"';

const SVG_BLOCK = `      <svg
        className="rounded-[10px]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="400" height="400" fill="#18181B" />
        <path
          d="M238.088 51.1218L238.089 51.1223L310.605 92.8101C334.028 106.308 348.526 131.32 347.868 157.953L347.867 157.966V157.978V241.688C347.867 268.68 333.687 293.362 310.271 306.856L310.269 306.858L237.754 348.878C214.336 362.374 185.643 362.374 162.225 348.878L89.7127 306.859C66.6206 293.361 52.1113 268.674 52.1113 241.688V157.978C52.1113 131.326 66.6211 106.307 89.7088 92.8093C89.7101 92.8085 89.7114 92.8078 89.7127 92.807L162.556 51.1233L162.559 51.1218C185.977 37.6261 214.67 37.6261 238.088 51.1218ZM124.634 200C124.634 241.576 158.502 275.372 200.156 275.372C242.142 275.372 276.013 241.578 276.013 200C276.013 158.419 241.805 124.628 200.156 124.628C158.502 124.628 124.634 158.424 124.634 200Z"
          fill="url(#paint0_linear_11869_12671)"
          stroke="url(#paint1_linear_11869_12671)"
          strokeWidth="2"
        />
        <defs>
          <linearGradient
            id="paint0_linear_11869_12671"
            x1="200"
            y1="40"
            x2="200"
            y2="360"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient
            id="paint1_linear_11869_12671"
            x1="200"
            y1="40"
            x2="200"
            y2="360"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" stopOpacity="0.7" />
          </linearGradient>
        </defs>
      </svg>`;

const IMG_BLOCK = `      <img
        src="/admin/logo"
        alt="GNC Store"
        className="h-full w-full rounded-[10px] object-contain"
      />`;

function main() {
  if (!fs.existsSync(dashboardRoot)) {
    console.warn("apply-admin-branding: @medusajs/dashboard not found, skipping.");
    return;
  }

  let changed = false;

  if (fs.existsSync(enJsonPath)) {
    let json = fs.readFileSync(enJsonPath, "utf8");
    if (json.includes(WELCOME_OLD)) {
      json = json.split(WELCOME_OLD).join(WELCOME_NEW);
      fs.writeFileSync(enJsonPath, json);
      changed = true;
    } else if (json.includes(WELCOME_LEGACY)) {
      json = json.split(WELCOME_LEGACY).join(WELCOME_NEW);
      fs.writeFileSync(enJsonPath, json);
      changed = true;
    }
  }

  if (fs.existsSync(avatarBoxPath)) {
    let tsx = fs.readFileSync(avatarBoxPath, "utf8");
    if (tsx.includes(SVG_BLOCK)) {
      tsx = tsx.replace(SVG_BLOCK, IMG_BLOCK);
      fs.writeFileSync(avatarBoxPath, tsx);
      changed = true;
    } else if (tsx.includes('src="/admin/logo"')) {
      // Already applied
    } else {
      console.warn("apply-admin-branding: avatar-box.tsx structure changed, logo not updated.");
    }
  }

  if (fs.existsSync(invitesHookPath)) {
    let invites = fs.readFileSync(invitesHookPath, "utf8");
    if (invites.includes("Register may return { token }")) {
      // Already applied by this script
    } else if (invites.includes(INVITE_ACCEPT_OLD)) {
      invites = invites.split(INVITE_ACCEPT_OLD).join(INVITE_ACCEPT_NEW);
      fs.writeFileSync(invitesHookPath, invites);
      changed = true;
    } else if (invites.includes("Authorization: `Bearer ${auth_token}`")) {
      console.warn(
        "apply-admin-branding: invites.tsx has unexpected formatting; invite token fix skipped. Try a clean npm install."
      );
    }
  }

  if (changed) {
    console.log("apply-admin-branding: store branding applied to admin dashboard.");
  }
}

main();
