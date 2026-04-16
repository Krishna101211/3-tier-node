#!/bin/bash
set -euo pipefail

AWS_REGION="us-east-1"
SECRET_NAME="user-registration-db"
USERNAME="postgres"
PASSWORD=$(openssl rand -base64 24)

echo "=== Creating secret in AWS Secrets Manager ==="

aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "PostgreSQL credentials for user registration app" \
    --secret-string "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\",\"host\":\"user-registration-db\",\"port\":\"5432\",\"dbname\":\"userdb\"}" \
    --region "$AWS_REGION"

echo "Secret created: $SECRET_NAME"
echo ""
echo "Add these to your GitHub repository secrets:"
echo "  DB_USER=$USERNAME"
echo "  DB_PASSWORD=$PASSWORD"
echo ""
echo "To retrieve later:"
echo "  aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text | jq -r '.password'"
