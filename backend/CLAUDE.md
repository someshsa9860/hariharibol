# Backend — HariHariBol API

Plain **Node.js. No TypeScript.** Simple, readable code. Prisma for the database.

## Structure

```
backend/
├── server.js              # entry point — boots the HTTP server, nothing else
├── app.js                 # the express app — mounts every routes/ dir + middleware
├── config/                # one file per concern: cors.js, cron.js, redis.js, database.js …
├── middleware/            # auth middleware — every request passes through it
├── routes/
│   ├── app/               # mobile app endpoints
│   ├── web/               # website endpoints
│   └── admin/             # admin panel endpoints
├── controllers/
│   ├── app/               # mirrors routes/ exactly, file for file
│   ├── web/
│   └── admin/
├── services/              # shared infra only: fcm.js, otp.js, websocket.js, auth.js …
├── views/                 # server-rendered templates
├── jobs/                  # BullMQ queues and processors (Redis-backed)
├── worker/                # background job runner — own Docker container
├── websocket/             # realtime server — own Docker container
├── deeplink/              # deeplink handling — own Docker container
└── prisma/
    └── schema.prisma      # model format
```

## Rules

1. **JavaScript, not TypeScript.** No build step for the API code.

2. **One `app.js`, one `server.js`.** `server.js` only starts the server. `app.js` wires middleware and mounts every routes directory — reading `app.js` alone should tell you every route family the API exposes.

3. **Routes and controllers are segregated by platform** — `app`, `web`, `admin`. A route file and its controller file mirror each other by path and name: `routes/app/user.js` → `controllers/app/user.js`.

4. **No service layer for controllers.** Controllers hold their own logic and talk to Prisma directly. `services/` is reserved for shared infrastructure that several controllers use — FCM, OTP, websocket, auth. Do not create a `userService` to wrap a `userController`.

5. **All requests pass through auth middleware.** Public endpoints opt out explicitly; the default is authenticated.

6. **Config lives in `config/`**, one file per concern (cors, crons, redis, database …). No configuration inline in `app.js` or in controllers.

7. **Jobs use BullMQ on Redis.** Queue definitions and processors live in `jobs/`; the `worker/` container runs them.

8. **`worker/`, `websocket/`, and `deeplink/` each get their own Docker container**, separate from the API container.

9. **Every endpoint is documented.** API docs are a requirement, not an afterthought, and they must look good — a browsable, well-presented reference, not a raw dump.

## Auth, roles and permissions

- **One auth service**, one users table. Admins and normal users are the same record type, separated by a `role` column.
- A single person can be both a normal user and an admin. Admin surfaces are reachable **only** if their role/permissions grant it.
- Use **standard roles**; the permission set is derived from this project's actual content and actions.

## Client attestation on signup

An unauthenticated account-creation request must be provably from **our own clients** — the mobile app or our website. Nobody should be able to create accounts by hitting the API directly.

## Code graph

A code-build-graph package should be wired up and re-run periodically so the structure stays navigable. *(Not currently installed — needs setting up; confirm which package is meant.)*

## Open questions

- **Platform folder naming** — rules say segregate by `app`/`web`/`admin`, but the example given was `routes/user` + `controllers/user`. Confirm whether the split is `app|web|admin` or `user|admin` (with `user` covering both mobile and web).
- **`views/`** — what renders here? Email templates, admin-side server-rendered pages, or something else?
- **API docs tool** — Scalar and Redoc both produce good-looking docs from an OpenAPI spec; Swagger UI is plainer. Pick one before the first endpoint ships.
- **Attestation mechanism** — Firebase App Check fits well since Firebase is already in use (Play Integrity on Android, App Attest on iOS, reCAPTCHA on web). Alternative is a signed-request HMAC scheme.
