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
  403 `UNAUTHENTICATED` exactly as the app does. Needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (and the same id in the API's
  `GOOGLE_CLIENT_IDS`); Apple needs `NEXT_PUBLIC_APPLE_CLIENT_ID` + redirect URI (and the Services ID in `APPLE_BUNDLE_IDS`).
  Where the API runs with `APP_CHECK_ENABLED=true`, set `NEXT_PUBLIC_FIREBASE_CONFIG` and `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` —
  `lib/auth/app-check.ts` then sends the App Check token on sign-in. See `.env.example`.
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
`NEXT_PUBLIC_*` values as build arguments (the addresses are in the workflow; `WEBSITE_GOOGLE_CLIENT_ID`,
`WEBSITE_APPLE_CLIENT_ID`, `WEBSITE_FIREBASE_CONFIG` and `WEBSITE_RECAPTCHA_SITE_KEY` are optional secrets), pushes it to
the ECR repository `hariharibol-website` as `:<sha>` and `:latest`, and runs `deploy/server/deploy.sh website` over SSH: pull
the image, restart `hariharibol-website` on `127.0.0.1:8081` (the port the host's web server already proxies). The smoke
check greps the home page for its headline. A `NEXT_PUBLIC_*` value cannot be changed on a running container — it is in the
browser bundle — so changing one means a new build. The API's `WEB_BASE_URL` must be the site's origin (CORS), and
`GOOGLE_CLIENT_IDS` must include the web client id.

The sitemap files are made at build time from the API (`app/sitemap.ts`), so a build made while the API is down ships an
empty sitemap until the next deploy. The build itself still succeeds.

## Not yet verified

Run against a local API with seeded test content in a real browser (home, library, book, chapter, verse, short work,
Bhagavatam canto route, search, jap counter and its sync, routine sync, favourites, reels, Sakha's error path, mobile and desktop).
**Not run:** Google / Apple sign-in itself (needs real client ids), App Check, Sakha against a live model, video reels, chant-along
audio, the production deploy. The 404 status of unknown chapters, verses and mantras was checked on the built server.
The standalone build was run as the container will run it (a bare copy of `.next/standalone`, the container's env vars)
and answered every page checked, the static files and `public/`; **the Docker image itself has not been built** (no Docker on
the machine it was written on) and the ECR push and server pull have not run.

- **Story mode** (`components/read/story-reader.tsx`): Reading settings → *Reading style*, or the Story button on the reader bar. One part of every verse (Sanskrit, transliteration, meaning, purport) as running text with small verse numbers; clicking a verse opens play / save / copy / open. Kept in `usePrefs().reader` (`mode`, `storyPart`, `storyNumbers`). Same behaviour as the app's story mode; not tried against a live API in a browser.
