# Map Custom Domain (unifiedomnichannel.com) to Cloud Run Storefront

Use this guide to serve your storefront at `https://unifiedomnichannel.com` instead of the default Cloud Run URL.

## Troubleshooting: site shows GoDaddy page instead of storefront

**Symptom**: `https://unifiedomnichannel.com` shows "Connect. Engage. Transform." or a GoDaddy parking page.

**Cause**: DNS for `unifiedomnichannel.com` points to GoDaddy (13.248.243.5, 76.223.105.230), not Google Cloud Run.

**Fix**:
1. **Disable GoDaddy Forwarding** (if enabled): DNS → Forwarding → Delete any forwarded URL. Forwarding overrides A records.
2. **Update A records** at GoDaddy to point to Google's IPs (see Step 3 below). Replace the existing GoDaddy A records (13.248.243.5, 76.223.105.230).
3. Save and wait 5–30 minutes. Google will then provision SSL; the site should load within ~1 hour.

---

## Prerequisites

- `unifiedomnichannel.com` (and/or `www.unifiedomnichannel.com`) registered with a domain registrar
- Access to your domain's DNS settings
- `gcloud` CLI installed and configured with your GCP project

---

## Option A: Cloud Run domain mapping (simplest)

### Step 1: Verify domain ownership

```bash
# Check if domain is already verified
gcloud domains list-user-verified

# If not verified, open the verification page in your browser
gcloud domains verify unifiedomnichannel.com
```

In the Search Console page that opens:

1. Choose your verification method (HTML file upload, DNS TXT record, HTML tag, or Google Analytics).
2. Complete the steps (e.g., add the TXT record at your DNS provider).
3. Click **Verify**.

### Step 2: Map domain to Cloud Run

**Using Console:**

1. Go to [Cloud Run Domain Mappings](https://console.cloud.google.com/run/domains?project=unifiedcommerce-487215).
2. Click **Add mapping**.
3. Select service: **medusa-storefront**.
4. Select **Cloud Run domain mappings**.
5. Base domain: **unifiedomnichannel.com**.
6. Click **Continue** until verification completes.
7. Click **Done**.

**Using gcloud:**

```bash
# Map the root domain
gcloud beta run domain-mappings create \
  --service medusa-storefront \
  --domain unifiedomnichannel.com \
  --region us-central1

# Optional: also map www subdomain
gcloud beta run domain-mappings create \
  --service medusa-storefront \
  --domain www.unifiedomnichannel.com \
  --region us-central1
```

### Step 3: Add DNS records (critical – currently incorrect for unifiedomnichannel.com)

**Problem**: If `unifiedomnichannel.com` shows a GoDaddy parking page instead of your storefront, your DNS is pointing to GoDaddy's servers, not Google Cloud Run. You must update the A records at GoDaddy.

**Current Cloud Run mapping** for unifiedomnichannel.com → medusa-storefront requires these DNS records.

**At GoDaddy** (My Products → DNS → Manage):

1. **Remove or edit** existing A records for `@` that point to GoDaddy IPs (e.g., 13.248.243.5, 76.223.105.230).
2. **Add these A records** for the root domain (`@` or `unifiedomnichannel.com`):

| Type | Name  | Value          | TTL  |
|------|-------|----------------|------|
| A    | @     | 216.239.32.21  | 3600 |
| A    | @     | 216.239.34.21  | 3600 |
| A    | @     | 216.239.36.21  | 3600 |
| A    | @     | 216.239.38.21  | 3600 |

**GoDaddy**: Delete existing A records for `@`, then Add → A record. Name: `@`. Add value `216.239.32.21`, click "Add another value" and add the other 3 IPs. Save.

3. **Optional – IPv6** (AAAA records):

| Type  | Name | Value                 |
|-------|------|-----------------------|
| AAAA  | @    | 2001:4860:4802:32::15 |
| AAAA  | @    | 2001:4860:4802:34::15 |
| AAAA  | @    | 2001:4860:4802:36::15 |
| AAAA  | @    | 2001:4860:4802:38::15 |

**Retrieve latest records** (run locally if Cloud Run output changes):

```bash
gcloud beta run domain-mappings describe --domain unifiedomnichannel.com --region us-central1 --project unifiedcommerce-487215
```

Look under `status.resourceRecords` for the exact A and AAAA values.

### Step 4: Wait for propagation and SSL

1. DNS changes can take 5–30 minutes (up to 48 hours).
2. Google will issue a managed SSL certificate (typically within 15–60 minutes).
3. Test: open `https://unifiedomnichannel.com`.

---

## Option B: Application Load Balancer (recommended for production)

Gives more control, CDN, custom SSL, and other features.

### Step 1: Reserve a global static IP

```bash
gcloud compute addresses create storefront-ip \
  --global \
  --network-tier PREMIUM
```

### Step 2: Create serverless NEG and backend

```bash
# Network endpoint group for Cloud Run
gcloud compute network-endpoint-groups create storefront-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=medusa-storefront

# Backend service
gcloud compute backend-services create storefront-backend \
  --global
```

### Step 3: Add NEG to backend

```bash
gcloud compute backend-services add-backend storefront-backend \
  --global \
  --network-endpoint-group=storefront-neg \
  --network-endpoint-group-region=us-central1
```

### Step 4: SSL certificate and URL map

Use [Set up global external Application Load Balancer with Cloud Run](https://cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless) and configure:

- Managed SSL certificate for `unifiedomnichannel.com`
- URL map routing to your backend service
- Forwarding rule using the static IP

### Step 5: DNS

At your registrar, add an **A record** pointing your domain to the static IP:

```bash
# Get the IP
gcloud compute addresses describe storefront-ip --global --format="value(address)"
```

---

## After setup

### 1. Update environment variables

Point the storefront and backend to the new domain:

```bash
# Deploy storefront with new base URL
STOREFRONT_URL="https://unifiedomnichannel.com" ./deploy/deploy-storefront.sh

# Update backend CORS
STORE_CORS="https://unifiedomnichannel.com" \
AUTH_CORS="https://unifiedomnichannel.com,https://medusa-backend-xxx.run.app" \
./deploy/deploy-backend.sh
```

### 2. Build-time config

For `NEXT_PUBLIC_BASE_URL`, rebuild the storefront image:

```bash
gcloud builds submit --config deploy/cloudbuild.yaml . \
  --substitutions=_NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxx,_NEXT_PUBLIC_BASE_URL=https://unifiedomnichannel.com
```

---

## Quick reference

| Task              | Command or link |
|-------------------|------------------|
| Verify domain     | `gcloud domains verify unifiedomnichannel.com` |
| Add mapping       | [Console → Cloud Run → Domain mappings](https://console.cloud.google.com/run/domains) |
| View DNS records  | `gcloud beta run domain-mappings describe --domain unifiedomnichannel.com --region us-central1` |
