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
| Share (verse, mantra, reel), invitations, Refer & Earn | `/shloka/<code>`, `/mantra/<code>`, `/divya/<code>` (public landing pages), `/satsang/<code>` (invitation), `/me/refer`; the Share Studio opens from the verse card, the home verse, a mantra page and a reel |

**Not on the website:** auto-count by sound, offline books, push reminders, creator publishing, buying a plan, donations.

## Share Studio, landing pages and Refer & Earn

Rules and the API are in "Sharing, deep links and Refer & Earn" in [backend/CLAUDE.md](../backend/CLAUDE.md).

- **Landing pages** (`components/share/share-landing.tsx`, pages `app/shloka|mantra|divya/[code]`, `app/satsang/[code]`) are server
  rendered from `GET /api/app/share/links/:code` (public, no token, so the page is the same for everyone): Open Graph and Twitter
  tags from the *public* view only, the canonical `https://hariharibol.com/<path>/<code>` URL, a real **404** for an unknown or
  wrong-kind code, and a `noindex` "no longer available" page for a revoked one (Next cannot send a 410 from a page). **Open in
  the app** is an explicit `hariharibol://…` link — installed-app detection from a web page is not reliable, so nothing here
  guesses it with a timer; opening the https link on a phone with the app is handled by Android App Links / iOS Universal Links
  (see the app's docs). **Continue on the website** goes to `/verse/<id>`, `/jap/<slug>` or `/reels/<id>`. Store buttons appear
  only for a store whose URL the API has (`PLAY_STORE_URL` / `APP_STORE_URL`); they are plain buttons, **not the stores' official
  badge artwork** — drop that in if brand rules need it. The QR code (`qrcode`, SVG, drawn on the server) encodes the page's own
  URL, so a phone that scans it gets the app-or-store handoff.
- **Share Studio** (`components/share/share-studio.tsx`, `lib/studio/design.ts`, `lib/studio/render.ts`; opened by `ShareButton`).
  One `Design` object; **the preview and the exported PNG are drawn by the same `renderCard` function at the same size**, so they
  cannot differ (formats 1080², 1080×1350, 1080×1920, 1200×630, whatever the screen density). Backgrounds: colours, gradients (up
  to 4 stops, angle), drawn "scenes" (sunrise, temple, lotus — no licensed photographs are bundled), the reader's own picture
  (real bytes sniffed for JPEG/PNG/WebP, ≤ 8 MB, 400–6000 px, zoom / position / blur / darken) and an AI-made one. Text: editable,
  font, weight, size, line height, alignment, colour, opacity, panel, margins, drag-to-position, transliteration / meaning /
  reference toggles. **A long verse is shrunk to fit, never cut** (the card says so). The **transparent logo**
  (`public/img/logo-transparent.png`, from the app's `hariharibol_trprt.png`) is drawn top-left at a fixed size with the text area
  below it, so it cannot be covered. Undo / restore defaults. Fonts are waited for (`document.fonts.load`) before drawing and
  exporting.
  - **Sharing**: native share with the picture (Web Share Level 2), else it saves the picture and copies the link and says so;
    share link, share as text, copy text, copy link, open the page. A link needs sign-in (it is made by `POST /share/links`).
    Cancelling a share sheet is not an error, and nothing claims a social network received anything.
  - **AI backgrounds** need sign-in and credits; the quote says whether one is affordable (never tokens), `402` shows "not enough
    credits" with a link to `/plans`, a failure says nothing was charged, and a retry reuses the request id so it is never
    charged twice. The picture is fetched through the API (`/share/background/:id/image`) so the canvas is not tainted.
  - Entry points: the verse card (every verse in the reader), the home verse, a mantra page, a reel's share button. Not on search
    results, favourites lists or the verse-of-the-day on other pages yet.
- **Invitations.** `/satsang/<code>` keeps the code in `localStorage` + a 14-day cookie (`lib/referral-store.ts`; the first one
  followed wins) and `ReferralClaimer` (mounted in the layout) hands it to `POST /referral/claim` after sign-in, dropping it on a
  final refusal and keeping it on a network failure. `/me/refer` shows the link, code, counts, rewards with dates, history, an
  "enter a code" box and the terms. Linked from `/me`.
- **Checked** in a real browser against a local API: the landing page for a mantra (title, Open Graph / Twitter tags, canonical,
  QR SVG, store link, app link), 404 for unknown and wrong-kind codes, the invitation page, and the studio opening from a mantra
  page — 1080² export with the logo top-left, a 40× repeated Devanagari verse shrunk to fit on a 1080×1920 story, and the PNG
  download. **Not run:** the AI-background tab and a share sheet (need sign-in and a real provider), `/me/refer` signed in, a
  verse page (the dev database has no verses), reels, and the studio on a phone.

## Commands

```
npm install
npm run dev        # http://localhost:3000 (the API's CORS list already allows it)
npm run build      # next build → .next/standalone (scripts/standalone.mjs adds static/ and public/)
npm run typecheck
```

Point it at a local API with `NEXT_PUBLIC_API_BASE_URL` in `.env.local` (see `.env.example`).

## Deploy

`.github/workflows/deploy-website.yml` builds (with the `NEXT_PUBLIC_*` values, some from secrets
`WEBSITE_GOOGLE_CLIENT_ID`, `WEBSITE_APPLE_CLIENT_ID`, `WEBSITE_FIREBASE_CONFIG`, `WEBSITE_RECAPTCHA_SITE_KEY`), packs
`.next/standalone` as `website.tgz`, uploads it, and `deploy/server/website.sh` unpacks it and runs it in a `node:22-alpine`
container on `127.0.0.1:8081` (the port the host's web server already proxies). **It is a Node server now, not static files:**
the first deploy needs the container image pulled and the new secrets set; the smoke check still greps the home page for its
headline. The API's `WEB_BASE_URL` must be the site's origin (CORS), and `GOOGLE_CLIENT_IDS` must include the web client id.

## Not yet verified

Run against a local API with seeded test content in a real browser (home, library, book, chapter, verse, short work,
Bhagavatam canto route, search, jap counter and its sync, routine sync, favourites, reels, Sakha's error path, mobile and desktop).
**Not run:** Google / Apple sign-in itself (needs real client ids), App Check, Sakha against a live model, video reels, chant-along
audio, the production deploy. The 404 status of unknown chapters, verses and mantras was checked on the built server.

- **Story mode** (`components/read/story-reader.tsx`): Reading settings → *Reading style*, or the Story button on the reader bar. One part of every verse (Sanskrit, transliteration, meaning, purport) as running text with small verse numbers; clicking a verse opens play / save / copy / open. Kept in `usePrefs().reader` (`mode`, `storyPart`, `storyNumbers`). Same behaviour as the app's story mode; not tried against a live API in a browser.
