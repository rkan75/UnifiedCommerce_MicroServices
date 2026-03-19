# HTTPS Setup Guide for unifiedomnichannel.com

## Why HTTPS isn't working

Your domain `unifiedomnichannel.com` is not using HTTPS because:

1. **DNS is pointing to GoDaddy** instead of Google Cloud Run
   - Current DNS likely has A records pointing to GoDaddy IPs (13.248.243.5, 76.223.105.230)
   - Google Cloud Run needs its own IP addresses in your DNS

2. **Domain mapping may not be configured** in Google Cloud Run
   - Cloud Run needs to know that `unifiedomnichannel.com` maps to your `medusa-storefront` service

3. **SSL certificate hasn't been provisioned**
   - Google automatically provisions SSL certificates **only after** DNS is correctly pointing to Cloud Run
   - This typically takes 15-60 minutes after DNS is fixed

---

## Quick Fix (Recommended)

Run the automated setup script:

```bash
./deploy/setup-https-domain.sh
```

This script will:
- Check domain verification
- Create domain mapping if needed
- Show you the exact DNS records to add at GoDaddy
- Guide you through the process

---

## Manual Setup Steps

### Step 1: Verify Domain Ownership

```bash
# Check if domain is verified
gcloud domains list-user-verified --project=unifiedcommerce-487215

# If not verified, start verification
gcloud domains verify unifiedomnichannel.com --project=unifiedcommerce-487215
```

1. A browser window will open with Google Search Console
2. Choose **DNS verification** (recommended)
3. Add the TXT record shown at GoDaddy DNS settings
4. Click **Verify** and wait for confirmation

### Step 2: Create Domain Mapping

```bash
gcloud beta run domain-mappings create \
  --service medusa-storefront \
  --domain unifiedomnichannel.com \
  --region us-central1 \
  --project unifiedcommerce-487215
```

Or use the [Cloud Console](https://console.cloud.google.com/run/domains?project=unifiedcommerce-487215):
1. Click **Add mapping**
2. Select service: **medusa-storefront**
3. Domain: **unifiedomnichannel.com**
4. Click **Continue** → **Done**

### Step 3: Get DNS Records from Google

```bash
gcloud beta run domain-mappings describe \
  --domain unifiedomnichannel.com \
  --region us-central1 \
  --project unifiedcommerce-487215
```

Look for `status.resourceRecords` - you'll see A and AAAA records with IP addresses.

### Step 4: Update DNS at GoDaddy (CRITICAL)

**Go to**: https://dcc.godaddy.com/manage/unifiedomnichannel.com/dns

**IMPORTANT**: You must do these steps in order:

1. **Delete URL Forwarding** (if enabled):
   - DNS → Forwarding → Delete any forwarded URLs
   - Forwarding overrides A records and prevents HTTPS

2. **Delete existing A records** pointing to GoDaddy:
   - Find A records for `@` (root domain) with values like `13.248.243.5` or `76.223.105.230`
   - Delete them

3. **Add new A records** from Google Cloud Run:
   - Click **Add** → **A record**
   - Name: `@` (or leave blank for root domain)
   - Value: Add each IP address from Step 3 (typically 4 IPs like `216.239.32.21`, `216.239.34.21`, etc.)
   - TTL: `3600` (1 hour)
   - Click **Add another value** for each additional IP
   - Save

4. **Optional - Add AAAA records** (IPv6):
   - Add AAAA records if provided in Step 3 output
   - Same process as A records

### Step 5: Wait for DNS Propagation and SSL

1. **DNS Propagation**: 5-30 minutes (can take up to 48 hours)
   - Check propagation: `dig unifiedomnichannel.com +short`
   - Should show Google Cloud IPs, not GoDaddy IPs

2. **SSL Certificate Provisioning**: 15-60 minutes after DNS is correct
   - Google automatically provisions managed SSL certificates
   - Check status:
     ```bash
     gcloud beta run domain-mappings describe \
       --domain unifiedomnichannel.com \
       --region us-central1 \
       --project unifiedcommerce-487215 \
       --format="yaml(status.conditions)"
     ```
   - Look for certificate condition with `status: True`

### Step 6: Test HTTPS

```bash
# Test HTTPS
curl -I https://unifiedomnichannel.com

# Should return: HTTP/2 200
# If you see certificate errors, DNS may not have propagated yet
```

---

## Troubleshooting

### Site still shows GoDaddy page

**Problem**: DNS is still pointing to GoDaddy

**Fix**:
1. Double-check DNS at GoDaddy - ensure A records point to Google IPs
2. Delete any URL forwarding
3. Wait 30-60 minutes for DNS propagation
4. Verify: `dig unifiedomnichannel.com +short` should show Google IPs

### Certificate errors or "Not Secure"

**Problem**: SSL certificate hasn't been provisioned yet

**Fix**:
1. Ensure DNS is correct (see above)
2. Wait 15-60 minutes for Google to provision SSL
3. Check certificate status (see Step 5)
4. If still failing after 2 hours, verify domain mapping exists:
   ```bash
   gcloud beta run domain-mappings list --region us-central1 --project unifiedcommerce-487215
   ```

### HTTP works but HTTPS doesn't

**Problem**: DNS is correct but SSL certificate isn't ready

**Fix**:
- Wait for SSL provisioning (15-60 minutes)
- Google Cloud Run automatically provisions SSL - no manual certificate upload needed

### Mixed content warnings

**Problem**: Some resources load over HTTP instead of HTTPS

**Fix**:
- Ensure `NEXT_PUBLIC_BASE_URL` is set to `https://unifiedomnichannel.com` in Cloud Run environment variables
- Rebuild storefront with correct base URL:
  ```bash
  NEXT_PUBLIC_BASE_URL=https://unifiedomnichannel.com ./deploy/build-and-deploy-storefront.sh
  ```

---

## Force HTTPS Redirect (Optional)

To redirect all HTTP traffic to HTTPS, add this to your Next.js middleware (`src/middleware.ts`):

```typescript
export function middleware(request: NextRequest) {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'http:') {
    return NextResponse.redirect(
      `https://${request.nextUrl.hostname}${request.nextUrl.pathname}${request.nextUrl.search}`,
      301
    )
  }
  // ... rest of your middleware
}
```

**Note**: Google Cloud Run's load balancer typically handles HTTP→HTTPS redirects automatically, so this may not be necessary.

---

## Verify Everything is Working

1. **DNS**: `dig unifiedomnichannel.com +short` shows Google IPs
2. **HTTP**: `curl -I http://unifiedomnichannel.com` redirects to HTTPS (or returns 200)
3. **HTTPS**: `curl -I https://unifiedomnichannel.com` returns `HTTP/2 200`
4. **Browser**: Visit `https://unifiedomnichannel.com` - should show padlock icon

---

## Summary

**The main issue**: Your DNS at GoDaddy is pointing to GoDaddy's servers instead of Google Cloud Run.

**The fix**: Update A records at GoDaddy to point to Google Cloud Run IPs (from domain mapping), then wait for SSL provisioning.

**Time required**: 30-90 minutes total (DNS propagation + SSL provisioning)

---

## Need Help?

- Check DNS: `dig unifiedomnichannel.com +short`
- Check domain mapping: `gcloud beta run domain-mappings describe --domain unifiedomnichannel.com --region us-central1`
- Check SSL status: Look for `status.conditions` in domain mapping output
- Google Cloud Run docs: https://cloud.google.com/run/docs/mapping-custom-domains
