# Backend — security/

Place secret **key files** here. This whole folder is mounted read-only into the
API container at `/app/security/` (see `docker-compose.yml`) and is git-ignored.

## Expected files

| File | Used by | .env variable pointing to it |
|------|---------|------------------------------|
| `firebase-service-account.json` | FCM push notifications | `FCM_SERVICE_ACCOUNT_PATH=/app/security/firebase-service-account.json` |
| `google-service-account.json` | Google APIs | `GOOGLE_SERVICE_ACCOUNT_PATH=/app/security/google-service-account.json` |
| `apple-signin-key.p8` | Apple Sign-In | `APPLE_PRIVATE_KEY_PATH=/app/security/apple-signin-key.p8` |
| `apns-key.p8` | Apple Push (APNs) | `APNS_PRIVATE_KEY_PATH=/app/security/apns-key.p8` |

> The container sees these at `/app/security/...`, NOT the host path. Always use
> the `/app/security/` prefix in `.env`.

## Permissions

Lock the folder down on the host:

```bash
chmod 700 /var/www/server/backend/security
chmod 600 /var/www/server/backend/security/*
```

## Upload from your machine

```bash
scp -i ~/.ssh/hariharibol.pem \
  firebase-service-account.json \
  ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com:/var/www/server/backend/security/
```
