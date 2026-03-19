#!/bin/bash
# Trace Medusa backend on Cloud Run: logs and revision status
# Usage:
#   ./deploy/trace-backend-logs.sh           # show recent logs
#   ./deploy/trace-backend-logs.sh --revisions  # show revision status then recent logs
#   ./deploy/trace-backend-logs.sh --revisions-only  # only revision status
#
# Live stream (alternative): gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=medusa-backend" --limit 50 --format="value(timestamp,severity,textPayload)" --freshness=1h

set -e

REGION="${REGION:-us-central1}"
SERVICE="medusa-backend"

show_revisions() {
  echo "=== Cloud Run revisions (latest first) ==="
  gcloud run revisions list \
    --service "$SERVICE" \
    --region "$REGION" \
    --format="table(name.basename(),status.conditions[0].status,active,creationTimestamp)" \
    --limit 5
  echo ""
}

case "${1:-}" in
  --revisions-only)
    show_revisions
    exit 0
    ;;
  --revisions)
    show_revisions
    ;;
esac

echo "Recent logs for $SERVICE (region: $REGION)."
echo "Look for: startup errors, DB connection, 'Listening on', or timeout."
echo ""

gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" \
  --project "${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}" \
  --limit 100 \
  --format="value(timestamp,severity,textPayload)" \
  --freshness=2h \
  2>/dev/null || gcloud run services logs read "$SERVICE" --region "$REGION" --limit 100

echo ""
echo "For live stream use Cloud Console: Cloud Run → medusa-backend → Logs"
echo "Or: gcloud beta logging tail \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE\""
