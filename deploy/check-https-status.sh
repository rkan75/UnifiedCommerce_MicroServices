#!/bin/bash
# Check HTTPS status for unifiedomnichannel.com
# Diagnoses why HTTPS might not be working

set -e

DOMAIN="unifiedomnichannel.com"
PROJECT_ID="${PROJECT_ID:-unifiedcommerce-487215}"
REGION="${REGION:-us-central1}"

echo "=========================================="
echo "HTTPS Status Check for $DOMAIN"
echo "=========================================="
echo ""

# Check 1: DNS Resolution
echo "1. DNS Resolution Check"
echo "-----------------------"
CURRENT_IPS=$(dig +short "$DOMAIN" 2>/dev/null | grep -E "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$" || echo "")
if [[ -z "$CURRENT_IPS" ]]; then
  echo "⚠ No A records found for $DOMAIN"
else
  echo "Current DNS A records:"
  echo "$CURRENT_IPS" | while read -r ip; do
    echo "  - $ip"
  done
  
  # Check if pointing to GoDaddy
  if echo "$CURRENT_IPS" | grep -qE "(13\.248\.243\.|76\.223\.105\.)"; then
    echo ""
    echo "❌ PROBLEM: DNS is pointing to GoDaddy IPs!"
    echo "   You need to update DNS at GoDaddy to point to Google Cloud Run IPs."
  else
    echo ""
    echo "✓ DNS appears to be pointing to Google Cloud (not GoDaddy)"
  fi
fi

echo ""
echo "2. Domain Mapping Check"
echo "-----------------------"
MAPPING=$(gcloud beta run domain-mappings describe --domain="$DOMAIN" --region="$REGION" --project="$PROJECT_ID" 2>/dev/null || echo "")
if [[ -z "$MAPPING" ]]; then
  echo "❌ No domain mapping found for $DOMAIN"
  echo "   Run: gcloud beta run domain-mappings create --service medusa-storefront --domain $DOMAIN --region $REGION"
else
  echo "✓ Domain mapping exists"
  
  # Extract expected IPs from mapping
  EXPECTED_IPS=$(echo "$MAPPING" | grep -A 5 "resourceRecords:" | grep "rrdata:" | sed 's/.*rrdata: //' | tr -d '"' | grep -E "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$" || echo "")
  if [[ -n "$EXPECTED_IPS" ]]; then
    echo ""
    echo "Expected Google Cloud Run IPs:"
    echo "$EXPECTED_IPS" | while read -r ip; do
      echo "  - $ip"
    done
  fi
fi

echo ""
echo "3. SSL Certificate Status"
echo "-------------------------"
if [[ -n "$MAPPING" ]]; then
  CERT_STATUS=$(echo "$MAPPING" | grep -A 10 "conditions:" | grep -E "(type|status|message)" || echo "")
  if echo "$CERT_STATUS" | grep -q "status: True"; then
    echo "✓ SSL certificate is active"
  elif echo "$CERT_STATUS" | grep -q "status: False"; then
    echo "⚠ SSL certificate is not ready yet"
    echo "   This is normal if DNS was just updated. Wait 15-60 minutes."
  else
    echo "⚠ Could not determine SSL certificate status"
    echo "   Check manually: gcloud beta run domain-mappings describe --domain=$DOMAIN --region=$REGION"
  fi
else
  echo "⚠ Cannot check SSL - domain mapping not found"
fi

echo ""
echo "4. HTTPS Connection Test"
echo "-----------------------"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$DOMAIN" 2>/dev/null || echo "000")
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" != "000" ]]; then
  echo "HTTP ($HTTP_STATUS): ✓ Site responds over HTTP"
else
  echo "HTTP: ❌ Site does not respond over HTTP"
fi

if [[ "$HTTPS_STATUS" != "000" ]]; then
  if [[ "$HTTPS_STATUS" == "200" ]]; then
    echo "HTTPS ($HTTPS_STATUS): ✓ Site works over HTTPS!"
  else
    echo "HTTPS ($HTTPS_STATUS): ⚠ Site responds but with status $HTTPS_STATUS"
  fi
else
  echo "HTTPS: ❌ Site does not respond over HTTPS"
  echo "       This usually means SSL certificate is not provisioned yet"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

if [[ "$HTTPS_STATUS" == "200" ]]; then
  echo "✅ HTTPS is working! Your site is secure."
elif echo "$CURRENT_IPS" | grep -qE "(13\.248\.243\.|76\.223\.105\.)"; then
  echo "❌ DNS is pointing to GoDaddy. Update DNS at GoDaddy to use Google Cloud Run IPs."
  echo ""
  echo "Next steps:"
  echo "  1. Run: ./deploy/setup-https-domain.sh"
  echo "  2. Follow the DNS update instructions"
  echo "  3. Wait 30-60 minutes for DNS propagation and SSL provisioning"
elif [[ -z "$MAPPING" ]]; then
  echo "❌ Domain mapping not configured. Create it first:"
  echo "  gcloud beta run domain-mappings create --service medusa-storefront --domain $DOMAIN --region $REGION"
else
  echo "⚠ HTTPS is not working yet. Common causes:"
  echo "  - DNS propagation still in progress (wait 30-60 minutes)"
  echo "  - SSL certificate provisioning (wait 15-60 minutes after DNS is correct)"
  echo ""
  echo "Check again in 30 minutes, or run: ./deploy/setup-https-domain.sh"
fi

echo ""
