# Website — hariharibol.com

The public site **and** a web version of the app: read the books, chant with a counter, watch reels, keep a routine, ask
Sakha. Next.js (App Router) + TypeScript, plain hand-written CSS, no UI library. It talks to the same API as the phone app
(`/api/app/*`) and to the SEO endpoints (`/api/web/content/*`).

## Rules

- **Reading, chanting, reels, search, plans are public.** No account is needed for them. **Only Ask Sakha needs one**
  (`components/sakha/sakha-gate.tsx`). Signed-in extras (favourites, progress, streak, routine sync) degrade to this
  browser's storage when signed out — never to a wall.
- **The verse of the day, the library and the mantras always show.** The home page falls back to a day-of-year pick of well-loved verses (`lib/daily-verse.ts`) when none is set, and when the *server* cannot reach the API the same sections load in the browser (`LiveSections`, `LibraryLoader`, `MantraLoader`).
- **Public content is server-rendered** so search engines get the words: books, chapters, verses, mantras, the home page.
  Pages fetch with `lib/api/server.ts` (no token, cached by Next for 1–10 minutes). Anything that depends on *who* is
  reading is a client component that fetches after load (`lib/api/client.ts`).
- **Reading language** is a cookie (`hhb_read`) the browser sets and the server reads (`lib/prefs/server.ts`), so a chapter
  is rendered in the reader's language; a crawler has no cookie and gets English. Changing it calls `router.refresh()`.
  The site's own wording is English only; verses, meanings, titles and mantras follow the reading language.
- **Sign-in is Google or Apple** (`lib/auth/social.ts`): the browser gets an identity token, `POST /auth/social` verifies it
  and returns the session. Tokens live in `localStorage` (`lib/auth/session-store.ts`); `lib/api/client.ts` renews them on a
  403 `UNAUTHENTICATED` exactly as the app does. Needs `WEBSITE_GOOGLE_CLIENT_ID` (and the same id in the API's
  `GOOGLE_CLIENT_IDS`); Apple needs `WEBSITE_APPLE_CLIENT_ID` + `NEXT_PUBLIC_APPLE_REDIRECT_URI` (and the Services ID in
  `APPLE_BUNDLE_IDS`). Where the API runs with `APP_CHECK_ENABLED=true`, set `WEBSITE_FIREBASE_CONFIG` and
  `WEBSITE_RECAPTCHA_SITE_KEY` — `lib/auth/app-check.ts` then sends the App Check token on sign-in. See `.env.example`.
- **The four `WEBSITE_*` sign-in values are read at run time, not build time** (`lib/runtime-config.ts`): the server reads
  `process.env` on each request, the root layout writes them into the page as `window.__HHB_CONFIG__`, and the browser code
  reads them back through `runtimeConfig()` — so `googleEnabled()` / `appleEnabled()` are functions, not constants. They
  are public values (a browser needs them), nothing secret goes through that path. Never name one `NEXT_PUBLIC_*`: that is
  written into the bundle by `next build` and could not be changed on a running container. On the server they live in the
  backend's own `.env` (below).
- **Śrīla Prabhupāda is not named yet** beside his translations (verse card, compare sheet) until permission is given:
  `SHOW_AUTHOR_NAME` in `lib/config.ts` (false), matched on `AUTHOR_SLUG`. Show a credit through `creditName()`
  (`lib/format.ts`), never `translator.name`. The app has the same switch (`AppConfig.showAuthorName`).
- **`/sources` (Sources & disclaimer, linked from the footer)** names the sources (`TEXT_SOURCES` in `lib/config.ts`, shown
  as text, not links), says the other languages are AI-assisted and Sakha is not a teacher, that the project is
  independent, and gives `CONTACT_EMAIL` for rights and corrections — the same wording as the app's Settings page. Only
  the Prabhupāda / © BBT line follows `SHOW_AUTHOR_NAME`.
- **Colours** follow the app: saffron on warm white in light, charcoal with a white accent in dark (`styles/tokens.css`).
  Saffron is a fill, never text (`--accent-ink` is the text version). Status is never colour alone — the routine's
  Early / On time / Late carry words.
- **Animations** are CSS (`styles/base.css`): `.enter` on first paint, `.reveal` (via `components/ui/reveal.tsx`) on scroll,
  hover lifts. They only hide content when the `js` class is on `<html>` and stop under `prefers-reduced-motion`.
- A component that reads `window` / `localStorage` does so in `useEffect` (or `useLocalState`, whose first render always uses
  the default) — date text that differs between Node and the browser caused a hydration error once; gate it behind `ready`.

## Structure

```
website/src/
├── app/                 # routes only — each page is a thin file
│   ├── page.tsx         # home: hero, today's verse, quick links, library, mantras, why, features, FAQ
│   ├── read/            # library · book index · chapter reader (/read/<slug>/<chapter> or /<canto>/<chapter>)
│   ├── verse/[verseId]  # canonical page for one verse (all translations, JSON-LD)
│   ├── jap/             # mantras + today's practice · /jap/<slug> the counter
│   ├── reels/           # the feed · /reels/<id> a shared reel
│   ├── sakha/           # Ask Sakha (sign-in gate → chat)
│   ├── routine/ plans/ feel/ search/ me/
│   └── sitemap.ts robots.ts not-found.tsx error.tsx layout.tsx
├── components/          # by feature: ui, layout, auth, home, read, jap, reels, sakha, routine, me
├── lib/                 # api/ (server + client + envelope), auth/, prefs/, types.ts, format.ts, links.ts, hooks
└── styles/              # tokens, base, components, layout, then one file per feature (imported by styles/index.css)
```

- **Types** for API shapes are in `lib/types.ts` (only the fields the site reads; the truth is `backend/utils/present.js`).
- **Links** to chapters and verses are built in one place, `lib/links.ts`.
- **Adding a page**: `app/<name>/page.tsx` with `metadata`, components in `components/<feature>/`, CSS in the feature file.
- **Where state lives**: the chant counter's round in progress (`lib/jap-store.ts`), the routine (`components/routine/`,
  mirrored by `POST /routine/sync`), reader settings and theme (`lib/prefs/`), guest reading position (`lib/resume.ts`).

## Features (what maps to the app)

| App | Website |
|---|---|
| Home dashboard | `/` — verse of the day, practice ring and streak when signed in, quick links |
| Read, chapter, verse, search | `/read…`, `/verse/…`, `/search` — Sanskrit, transliteration, word meanings, translation, purport, recitation (single and "play chapter"), compare translations, favourites, reading settings, progress |
| Jap | `/jap`, `/jap/<slug>` — 108 counter (tap / Space), opening prayer, chant-along recording, rounds synced to the account, manual rounds, daily target, streak |
| Reels | `/reels` — public feed, overlays, like / save / comment / share / follow need an account |
| Ask Sakha | `/sakha` — streaming, stop, answer again, clear, pictures, voice input, credit meter, "open this page" offers |
| Routine | `/routine` — local first, synced when signed in |
| Plans | `/plans` — read-only; purchases happen in the apps |
| Settings → Sources & disclaimer | `/sources` |
| Verse for how you feel | `/feel` |
| Notes, related verses | notes sheet on each verse (account); "Related verses" on `/verse/<id>` |
| Notifications, practice report | `/notifications`; 30-day report on `/me` |
| Creator profile | `/creator/<id>` — reels grid, follow |

**Not on the website:** auto-count by sound, offline books, push reminders, creator publishing, buying a plan, donations.

## Commands

```
npm install
npm run dev        # http://localhost:3000 (the API's CORS list already allows it)
npm run build      # next build → .next/standalone (scripts/standalone.mjs adds static/ and public/)
npm run typecheck
```

Point it at a local API with `NEXT_PUBLIC_API_BASE_URL` in `.env.local` (see `.env.example`).

## Deploy

`website/Dockerfile` builds the site into one small image (`npm run build`, then only `.next/standalone` is copied into a
`node:22-alpine` runtime that runs as the `node` user under tini). `.github/workflows/deploy-website.yml` — which, like the
backend and admin workflows, runs only for the `production` branch — typechecks and builds, then builds that image with the
three addresses (`NEXT_PUBLIC_*`, written in the workflow) as build arguments, pushes it to the ECR repository
`hariharibol-website` as `:<sha>` and `:latest`, and runs `deploy/server/deploy.sh website` over SSH: pull the image,
restart `hariharibol-website` on `127.0.0.1:8081` (the port the host's web server already proxies). The smoke check greps
the home page for its headline. A `NEXT_PUBLIC_*` value cannot be changed on a running container — it is in the browser
bundle — so changing one means a new build.

**The container's settings come from the backend's `.env`**, `/var/www/hariharibol/server/.env`, not from GitHub secrets:
`deploy/server/website.sh` reads `WEBSITE_GOOGLE_CLIENT_ID`, `WEBSITE_APPLE_CLIENT_ID`, `WEBSITE_FIREBASE_CONFIG`,
`WEBSITE_RECAPTCHA_SITE_KEY` and optionally `WEBSITE_API_URL` (how the container reaches the API; not the backend's own
`API_BASE_URL`, which is never passed on) from it and gives the container only those, with `-e`, never the whole file (it
holds the database URL, the JWT secret and the AWS and AI keys). The Firebase config may instead be a file in the secrets
folder, like `GOOGLE_SERVICE_ACCOUNT_PATH`: `WEBSITE_FIREBASE_CONFIG_PATH=/app/secrets/<file>`, read **on the host** by
`website.sh` (the container never mounts `secrets/`) and passed on as `WEBSITE_FIREBASE_CONFIG`; the file wins over an
inline value, and a path that cannot be read stops the deploy before the old container is stopped. The server keeps only a
web config's own keys (`publicFirebaseConfig` in `lib/runtime-config.ts`), so a service-account file named by mistake
comes out empty, not published. After editing the file, `cd /var/www/hariharibol/server &&
./deploy.sh website` restarts the container with the new values — no build. The API's `WEB_BASE_URL` must be the site's
origin (CORS), `GOOGLE_CLIENT_IDS` must include the web client id and `APPLE_BUNDLE_IDS` the Apple Services ID.

The sitemap files are made at build time from the API (`app/sitemap.ts`), so a build made while the API is down ships an
empty sitemap until the next deploy. The build itself still succeeds.

## Share studio, landing pages and refer

`/shloka/[code]`, `/naam/[code]`, `/darshan/[code]` and `/satsang/[code]` are server-rendered public pages
(`components/share/shared-page.tsx`): Open Graph tags, a QR code, store badges (hidden until `PLAY_STORE_URL` /
`APP_STORE_URL` are set on the API), an "Open in the app" button (`hariharibol://open?path=…`, phones only) and
"Continue on website". An unknown code is a 404, never a guess. `/refer` is the signed-in invite page.

The **share studio** (`components/share/share-studio.tsx`, `lib/share-card.ts`) draws one canvas for the preview and
the export, so they cannot differ: themes and gradients, an uploaded or AI-made background (the AI one is paid from
the reader's Ask Sakha credit, with a quote first), text size/colour, the transparent logo top left
(`public/img/logo-transparent.png`), 1:1 / 4:5 / 9:16 / 16:9, native share, copy and download. Opened from the
verse card, sloka card, reel, Jap counter, search and Me. `referral-attributor.tsx` keeps an invitation code from the
link until sign-in and presents it once. Verified in a real browser against a local API; the real store listings,
a live AI picture and the association files on the live domain have not been tried.

## Not yet verified

Run against a local API with seeded test content in a real browser (home, library, book, chapter, verse, short work,
Bhagavatam canto route, search, jap counter and its sync, routine sync, favourites, reels, Sakha's error path, mobile and desktop).
**Not run:** Google / Apple sign-in itself (needs real client ids), App Check, Sakha against a live model, video reels, chant-along
audio, the production deploy. The 404 status of unknown chapters, verses and mantras was checked on the built server.
The standalone build was run as the container will run it (a bare copy of `.next/standalone`, the container's env vars)
and answered every page checked, the static files and `public/`. **First deployed 2026-10-21** by `deploy-website.yml` (built in
CI, pushed to ECR, pulled and started on the server); on the live site the home page, `/read`, `/jap`, `/plans`, `/sources`, the
sitemap files (about 13,700 verse URLs) and a 404 were checked. Not checked live: sign-in (no `WEBSITE_*` key is in the
server's `.env` yet, so no web client id reaches the page) and reels while signed out (the live API answers a signed-out
`GET /api/app/reels` with 403 until the backend on `main` is released). The run-time config was checked on a build made with no
sign-in values: the standalone server, started with the four `WEBSITE_*` variables, wrote them into the page (a `</script>` inside
a value came out escaped) and none of them is in `.next/static`; `website.sh`'s reading of the `.env` was run against a stub
`docker` (CRLF line ends, quoted values, an empty key, a missing file; no backend key reaches the container).

- **Story mode** (`components/read/story-reader.tsx`): Reading settings → *Reading style*, or the Story button on the reader bar. One part of every verse (Sanskrit, transliteration, meaning, purport) as running text with small verse numbers; clicking a verse opens play / save / copy / open. Kept in `usePrefs().reader` (`mode`, `storyPart`, `storyNumbers`). Same behaviour as the app's story mode; not tried against a live API in a browser.
