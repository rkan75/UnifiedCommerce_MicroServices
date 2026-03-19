#!/bin/bash
# Setup HTTPS for unifiedomnichannel.com on Google Cloud Run
# This script verifies domain ownership, creates domain mapping, and provides DNS instructions
#
# Prerequisites:
#   - Domain unifiedomnichannel.com registered (currently at GoDaddy)
#   - gcloud CLI installed and authenticated
#   - Cloud Run service medusa-storefront deployed
#
# Usage:
#   ./deploy/setup-https-domain.sh

set -e

PROJECT_ID="${PROJECT_ID:-unifiedcommerce-487215}"
REGION="${REGION:-us-central1}"
DOMAIN="unifiedomnichannel.com"
SERVICE="medusa-storefront"

echo "=========================================="
echo "HTTPS Setup for $DOMAIN"
echo "=========================================="
echo ""

# Step 1: Check if domain is verified
echo "Step 1: Checking domain verification..."
if gcloud domains list-user-verified --project="$PROJECT_ID" 2>/dev/null | grep -q "$DOMAIN"; then
  echo "✓ Domain $DOMAIN is already verified"
else
  echo "⚠ Domain $DOMAIN is NOT verified"
  echo ""
  echo "To verify domain ownership:"
  echo "  1. Run: gcloud domains verify $DOMAIN --project=$PROJECT_ID"
  echo "  2. Follow the instructions in the browser that opens"
  echo "  3. Choose verification method (DNS TXT record recommended)"
  echo "  4. Add the TXT record at GoDaddy DNS settings"
  echo "  5. Wait for verification (can take a few minutes)"
  echo ""
  read -p "Press Enter after domain is verified, or Ctrl+C to exit..."
fi

# Step 2: Check if domain mapping exists
echo ""
echo "Step 2: Checking domain mapping..."
MAPPING_EXISTS=$(gcloud beta run domain-mappings describe --domain="$DOMAIN" --region="$REGION" --project="$PROJECT_ID" 2>/dev/null || echo "")

if [[ -n "$MAPPING_EXISTS" ]]; then
  echo "✓ Domain mapping already exists for $DOMAIN"
else
  echo "⚠ No domain mapping found. Creating domain mapping..."
  gcloud beta run domain-mappings create \
    --service="$SERVICE" \
    --domain="$DOMAIN" \
    --region="$REGION" \
    --project="$PROJECT_ID"
  echo "✓ Domain mapping created"
fi

# Step 3: Get DNS records
echo ""
echo "Step 3: Retrieving DNS records from Google Cloud Run..."
DNS_OUTPUT=$(gcloud beta run domain-mappings describe --domain="$DOMAIN" --region="$REGION" --project="$PROJECT_ID" --format="yaml(status.resourceRecords)")

if [[ -z "$DNS_OUTPUT" ]]; then
  echo "⚠ Could not retrieve DNS records. Domain mapping may still be provisioning."
  echo "   Wait a few minutes and run this script again."
  exit 1
fi

echo ""
echo "=========================================="
echo "DNS CONFIGURATION REQUIRED"
echo "=========================================="
echo ""
echo "IMPORTANT: You MUST update DNS at GoDaddy for HTTPS to work!"
echo ""
echo "Go to: https://dcc.godaddy.com/manage/unifiedomnichannel.com/dns"
echo ""
echo "1. DELETE existing A records for @ that point to GoDaddy IPs"
echo "   (e.g., 13.248.243.5, 76.223.105.230)"
echo ""
echo "2. DELETE any URL Forwarding (DNS → Forwarding → Delete)"
echo ""
echo "3. ADD these A records (replace existing @ records):"
echo ""

# Extract A records from the output
echo "$DNS_OUTPUT" | grep -A 20 "resourceRecords:" | grep -E "(rrdata|name)" | while IFS= read -r line; do
  if echo "$line" | grep -q "rrdata:"; then
    IP=$(echo "$line" | sed 's/.*rrdata: //' | tr -d '"')
    if [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "   Type: A"
      echo "   Name: @"
      echo "   Value: $IP"
      echo "   TTL: 3600"
      echo ""
    fi
  fi
done

# Also show the command to get exact records
echo "To get exact DNS records, run:"
echo "  gcloud beta run domain-mappings describe --domain=$DOMAIN --region=$REGION --project=$PROJECT_ID"
echo ""
echo "Look for 'status.resourceRecords' section with type 'A' and 'AAAA' records."
echo ""

# Step 4: Check SSL certificate status
echo ""
echo "Step 4: SSL Certificate Status"
echo "=========================================="
echo ""
echo "After DNS is updated:"
echo "  1. Wait 5-30 minutes for DNS propagation"
echo "  2. Google will automatically provision SSL certificate (15-60 minutes)"
echo "  3. Check status:"
echo "     gcloud beta run domain-mappings describe --domain=$DOMAIN --region=$REGION --project=$PROJECT_ID"
echo ""
echo "Look for 'status.conditions' - certificate is ready when status is 'True'"
echo ""

# Step 5: Verify HTTPS
echo ""
echo "Step 5: Testing HTTPS"
echo "=========================================="
echo ""
echo "After DNS propagates and SSL is provisioned:"
echo "  Test: curl -I https://$DOMAIN"
echo "  Should return: HTTP/2 200"
echo ""
echo "If you see certificate errors, DNS may not have propagated yet."
echo ""

# Step 6: Force HTTPS redirect (optional - via Next.js middleware)
echo ""
echo "Step 6: Force HTTPS Redirect (Optional)"
echo "=========================================="
echo ""
echo "To force HTTPS redirects, ensure your Next.js middleware redirects HTTP to HTTPS."
echo "Check: unifiedcommerce-grocery-store-storefront/src/middleware.ts"
echo ""

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Update DNS at GoDaddy with the A records shown above"
echo "  2. Wait 30-60 minutes for DNS propagation and SSL provisioning"
echo "  3. Test: https://$DOMAIN"
echo "  4. If still not HTTPS, check DNS propagation:"
echo "     dig $DOMAIN +short"
echo "     (Should show Google Cloud IPs, not GoDaddy IPs)"
echo ""
