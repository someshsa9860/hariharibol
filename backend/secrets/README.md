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

## IP location database (country, state, district, city)

`GeoLite2-City.mmdb`, MaxMind's free city database. The API reads it from disk to turn a signed-in
request's IP address into a place and saves that place on the `User` row (`services/geo-ip.js`). Nothing
is sent to anyone: the lookup is in memory.

1. Make a free account at <https://www.maxmind.com/en/geolite2/signup> and create a **license key**
   (Account → Manage license keys).
2. Download and unpack the City edition into this folder:

   ```
   curl -sSL -o /tmp/geolite2-city.tar.gz \
     "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_KEY&suffix=tar.gz"
   mkdir -p /tmp/geolite2 && tar -xzf /tmp/geolite2-city.tar.gz -C /tmp/geolite2
   mv /tmp/geolite2/*/GeoLite2-City.mmdb backend/secrets/
   ```

3. Point the environment at it (`backend/.env`; on the server `/app/secrets/GeoLite2-City.mmdb`, the folder
   `deploy/server/api.sh` already mounts):

   ```
   GEOIP_DB_PATH=secrets/GeoLite2-City.mmdb
   ```

Blank, or a file that is not there, switches it off: the API boots and the location columns stay empty.
The file is read once, so **restart the API after replacing it**. MaxMind refreshes the database twice a
week; monthly is plenty. It is 60–70 MB on disk and about that much in memory (the file is mapped into a
Buffer, outside the Node heap), which matters in the 512 MB API container — check `docker stats` after the
first start. The GeoLite2 licence also asks that you keep it current and credit MaxMind in your privacy
information; read it before shipping.

