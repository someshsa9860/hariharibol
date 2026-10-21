# secrets/

Credential files live here and are **never** committed — the `.gitignore` beside
this file ignores everything except itself and this README.

## Google service account

Firebase Console → Project settings → Service accounts → **Generate new private
key**. Save the downloaded JSON here and point the environment at it:

```
GOOGLE_SERVICE_ACCOUNT_PATH=secrets/hari-hari-bol-service-account.json
```

The path may be relative to the `backend/` directory or absolute. It is read
once, lazily, the first time Firebase Admin is needed.

This one file covers everything the backend does with Firebase:

| Used by | For |
|---|---|
| `services/fcm.js` | sending push notifications |
| `middleware/attestation.js` | verifying App Check tokens on sign-up |

Without it the backend still boots — push and App Check simply switch off, which
is what a local dev box wants. The older `FIREBASE_PROJECT_ID` /
`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` trio still works and is the
better fit for a container where mounting a file is awkward; the file path wins
when both are set.

**In production**, prefer whatever your host offers for secret material over a
file on disk, and never bake this JSON into an image.

## Store credentials (subscriptions)

| File | Env variable | From |
|---|---|---|
| Play Developer API service account JSON | `GOOGLE_PLAY_SERVICE_ACCOUNT_PATH` | Google Cloud → IAM → Service accounts → Keys |
| App Store Connect API key `AuthKey_XXXX.p8` | `APPLE_PRIVATE_KEY_PATH` | App Store Connect → Integrations → In-App Purchase |

Step by step in [docs/store-subscriptions.md](../docs/store-subscriptions.md).
