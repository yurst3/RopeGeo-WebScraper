#!/usr/bin/env bash
# Generates an RDS IAM auth token for the production database.
# Usage: npm run get-prod-db-auth-token
# Requires: AWS CLI, and either PROD_RDS_HOST + PROD_DATABASE_USERNAME, or PROD_STACK_NAME (to fetch endpoint from CloudFormation).
# Optional: AWS_REGION (default us-east-1), PROD_STACK_NAME (default WebScraper-Prod).

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
PROD_STACK_NAME="${PROD_STACK_NAME:-WebScraper-Prod}"

echo "Checking AWS CLI login..."
if ! aws sts get-caller-identity --region "$AWS_REGION" &>/dev/null; then
  echo "Not logged in. Running: aws sso login"
  aws sso login
  if ! aws sts get-caller-identity --region "$AWS_REGION" &>/dev/null; then
    echo "Still not logged in. Ensure you have valid AWS credentials (e.g. aws sso login, or set AWS_PROFILE)."
    exit 1
  fi
fi
echo "Logged in."
echo ""

if [ -n "$PROD_RDS_HOST" ]; then
  DB_ENDPOINT="$PROD_RDS_HOST"
else
  echo "Fetching production database endpoint from CloudFormation stack: $PROD_STACK_NAME"
  DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$PROD_STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ProductionDatabaseEndpoint'].OutputValue" \
    --output text 2>/dev/null) || true
  if [ -z "$DB_ENDPOINT" ] || [ "$DB_ENDPOINT" == "None" ]; then
    echo "Error: Could not get ProductionDatabaseEndpoint. Set PROD_RDS_HOST or ensure PROD_STACK_NAME ($PROD_STACK_NAME) exists and has that output."
    exit 1
  fi
fi

DB_USER="${PROD_DATABASE_USERNAME:-prodUser}"

echo "Generating RDS IAM auth token for $DB_USER @ $DB_ENDPOINT ($AWS_REGION)"
echo ""
TOKEN=$(aws rds generate-db-auth-token --hostname "$DB_ENDPOINT" --port 5432 --username "$DB_USER" --region "$AWS_REGION")
echo "--- Copy the token below (paste as password in DBeaver); it expires in ~15 minutes ---"
echo ""
echo "$TOKEN"
echo ""
echo "--- End token ---"
