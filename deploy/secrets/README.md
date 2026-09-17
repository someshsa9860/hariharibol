# Server secrets

This directory is created beside `server/` on the deployment host:

```text
/opt/hariharibol/
├── server/
│   ├── .env
│   └── docker-compose.yml
└── secrets/
    ├── hari-hari-bol-service-account.json
    └── cloudfront-private-key.pem
```

Credential files are never copied into a Docker image or committed to Git.
Backend containers receive this directory read-only at `/app/secrets`.
Configure the Google service-account filename in `server/.env` with
`GOOGLE_SERVICE_ACCOUNT_PATH=/app/secrets/<filename>`.
