#!/bin/bash
set -euo pipefail

echo "=== Setting up AWS Amplify for frontend hosting ==="

AMPLIFY_APP_NAME="user-registration-frontend"

APP_ID=$(aws amplify create-app \
    --name "$AMPLIFY_APP_NAME" \
    --repository "https://github.com/$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/' || echo 'YOUR_USERNAME/YOUR_REPO')" \
    --platform WEB \
    --query 'app.appId' \
    --output text 2>/dev/null || echo "")

if [ -z "$APP_ID" ]; then
    echo "Could not auto-create Amplify app. Creating without repo..."
    APP_ID=$(aws amplify create-app \
        --name "$AMPLIFY_APP_NAME" \
        --platform WEB \
        --build-spec '{
            "version": 1,
            "frontend": {
                "phases": {
                    "preBuild": {"commands": ["echo No build needed"]},
                    "build": {"commands": ["echo Static site"]}
                },
                "artifacts": {
                    "baseDirectory": "frontend/public",
                    "files": ["**/*"]
                }
            }
        }' \
        --query 'app.appId' \
        --output text)
fi

echo "Amplify App ID: $APP_ID"
echo ""
echo "Add this to your GitHub repository secrets:"
echo "  AMPLIFY_APP_ID=$APP_ID"
echo ""
echo "Next steps:"
echo "  1. Go to AWS Console > Amplify > $AMPLIFY_APP_NAME"
echo "  2. Connect your GitHub repository"
echo "  3. Set branch to 'main'"
echo "  4. Build settings: output directory = frontend/public"
echo "  5. Set environment variable API_URL = http://<EC2_PUBLIC_IP>/api/users"
echo "  6. Update frontend/public/index.html to use the Amplify URL for API calls"
