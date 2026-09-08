# HariHariBol

A spiritual learning platform: Vedic verses, mantras, narrations, chanting.

This is a **deliberate rebuild**. The previous version grew too complex to navigate and was retired. Its full source is archived on the `unorganized` branch — read from it with `git show unorganized:<path>`, don't copy its patterns forward.

## Layout

| Dir | What | Rules |
|---|---|---|
| `app/` | Mobile app (Flutter) | [app/CLAUDE.md](app/CLAUDE.md) |
| `backend/` | API (plain Node.js) | [backend/CLAUDE.md](backend/CLAUDE.md) |
| `admin/` | Admin panel | [admin/CLAUDE.md](admin/CLAUDE.md) |

Each part carries its own rules file. Read the relevant one before writing code in it.

## Guiding principle

**Simple over clever.** The last rebuild failed because the owner could not find his own routes and controllers. Every structural decision is judged by one question: can a developer open the repo and find the thing they're looking for without being told where it is?

- Predictable folder names over clever abstraction
- Flat over deeply nested
- Obvious file names — `routes/app/user.js` beats `modules/users/infrastructure/http/user.routes.js`
- Don't add a layer until it earns its place

## Conventions

**Commits** — `<type>: <description>` under 70 chars. Types: `feat`, `fix`, `refactor`, `docs`, `chore`.

**Branches** — `feat/<name>`, `fix/<name>`.

**Secrets** — never committed. `.env`, Firebase configs (`google-services.json`, `GoogleService-Info.plist`, `firebase_options.dart`) and Android signing keys (`key.jks`, `key.properties`) are gitignored. Local copies of the previous project's are backed up outside the repo at `../hariharibol-local-secrets/` — the Android keystore there is irreplaceable.

**CI** — `.github/workflows/` is preserved from the previous setup (ECR build+push). Trigger branches and paths will need updating when the new structure lands.

## Status

Skeleton only. Rules are being defined per part before any code is written.
