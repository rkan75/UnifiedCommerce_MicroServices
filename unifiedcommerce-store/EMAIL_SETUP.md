# Email Configuration for Medusa Admin Invites

## Problem
Medusa admin invites are created successfully, but recipients are not receiving emails because **no notification provider is configured**.

## Solution Options

Medusa v2 requires a **notification provider** to be configured to send emails. Here are your options:

### Option 1: SendGrid (Recommended for Production)

1. **No installation needed!** The SendGrid notification provider is already included with `@medusajs/medusa@2.12.6`.

2. **Get SendGrid API Key:**
   - Sign up at https://sendgrid.com
   - Go to Settings → API Keys and create a new key
   - Create an API Key with "Mail Send" permissions

3. **Add to `.env`:**
   ```env
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```

4. **Update `medusa-config.ts`:**
   ```typescript
   import { loadEnv, defineConfig } from '@medusajs/framework/utils'

   loadEnv(process.env.NODE_ENV || 'development', process.cwd())

   const config: any = {
     projectConfig: {
       databaseUrl: process.env.DATABASE_URL,
       http: {
         storeCors: process.env.STORE_CORS!,
         adminCors: process.env.ADMIN_CORS!,
         authCors: process.env.AUTH_CORS!,
         jwtSecret: process.env.JWT_SECRET || "supersecret",
         cookieSecret: process.env.COOKIE_SECRET || "supersecret",
       }
     },
     modules: [
       {
         resolve: "@medusajs/medusa/notification",
         options: {
           providers: [
             {
               resolve: "@medusajs/medusa/notification-sendgrid",
               id: "sendgrid",
               options: {
                 api_key: process.env.SENDGRID_API_KEY!,
                 from: process.env.SENDGRID_FROM_EMAIL!,
               },
             },
           ],
         },
       },
     ],
   }

   // Add RBAC module when feature flag is enabled
   if (process.env.MEDUSA_FF_RBAC === "true") {
     config.modules.push({
       resolve: "@medusajs/medusa/rbac",
     })
   }

   module.exports = defineConfig(config)
   ```

### Option 2: AWS SES (Amazon Simple Email Service)

1. **Install AWS SES package:**
   ```bash
   npm install @medusajs/notification-ses
   ```

2. **Configure AWS credentials:**
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_SES_FROM_EMAIL=noreply@yourdomain.com
   ```

3. **Update `medusa-config.ts`** (similar structure as SendGrid)

### Option 3: SMTP (For Development/Testing)

For local development, you can use a local SMTP server or services like:
- **Mailtrap** (https://mailtrap.io) - Free for testing
- **MailHog** (https://github.com/mailhog/MailHog) - Local SMTP testing
- **Gmail SMTP** (for testing only)

1. **Add SMTP config to `.env`:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_FROM=noreply@yourdomain.com
   ```

2. **You may need a custom notification provider** or use a package like `nodemailer` with a custom notification module.

### Option 4: Local Development - Check Invites in Database

For local development, you can check if invites are being created:

```bash
# Run this script to see pending invites
npx medusa exec ./src/scripts/check-rbac-data.ts
```

The invite will be created in the database, but the email won't be sent until a notification provider is configured.

## Verification

After configuring a notification provider:

1. **Restart your Medusa backend**
2. **Send a test invite** from the User & Role Management page
3. **Check your email** (or Mailtrap/MailHog inbox if using those)
4. **Check backend logs** for any email sending errors

## Notes

- **Development**: Use Mailtrap or MailHog to catch emails without sending real emails
- **Production**: Use SendGrid, AWS SES, or another production email service
- **Invites are still created** in the database even without email - users just won't receive notification emails
- The invite link can be manually shared if needed (check the database for the invite token)
