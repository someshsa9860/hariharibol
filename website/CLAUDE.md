# Website — hariharibol.com landing page

The public marketing page: one page, no router, no API calls.

## Rules

**Stack** — React + Vite + TypeScript, the same versions and conventions as
`admin/` (kebab-case files, flat folders, `@/` → `src/`). Plain CSS, no
Tailwind: the page's look was written as one stylesheet before the React
conversion and is kept as hand-written CSS, split per section.

**Prerendered, unlike the admin panel.** This is a public page: search
engines, link previews and slow phones should get the words before any
JavaScript runs, and the deploy's smoke check greps the live HTML for the
headline. So `npm run build` renders `<App />` to a string and writes it into
`dist/index.html` (`scripts/prerender.mjs`); the browser then *hydrates* it
(`src/main.tsx`). The build is three steps — `vite build` (the client),
`vite build --ssr` (`src/entry-server.tsx`, deleted afterwards), then the
prerender script. `npm run dev` skips prerendering and just mounts the app.

A component that reads `window` / `document` must do it inside `useEffect`
(see `lib/use-scrolled-past.ts`), because it is also run in Node at build
time. Anything that differs between server and browser output causes a
hydration warning — keep the first render the same in both.

## Structure

```
website/
├── index.html            # shell: SEO / Open Graph meta, fonts, <div id="root">
├── public/img/           # copied as-is to dist/img (logo.png is the og:image)
├── scripts/prerender.mjs # writes the rendered page into dist/index.html
└── src/
    ├── main.tsx          # browser entry: hydrate (or mount, in dev)
    ├── entry-server.tsx  # build-time entry: render() → HTML string
    ├── app.tsx           # the page: sections in order
    ├── site.ts           # Play Store link, contact email, nav links
    ├── sections/         # one file per band of the page, top to bottom
    ├── components/       # small shared pieces (icon, reveal, verse, …)
    ├── lib/              # hooks that touch the browser (scroll, active section)
    └── styles/           # one CSS file per section + tokens/base/buttons
```

- **Editing words** — the copy lives in the section file it appears in.
  Repeated items (cards, questions, languages) are a `const` array at the
  top — `REASONS`, `FAQS`, `REELS`, `LANGUAGES`, … — so changing or adding
  one is a one-line edit; nothing else needs to know.
- **Links and the contact email** — `src/site.ts`, once.
- **Adding a section** — create `sections/<name>.tsx` and
  `styles/<name>.css`, add the component to `app.tsx`, and add the CSS to
  `styles/index.css`. If it should appear in the nav, give the `<section>`
  an `id` and add it to `NAV_LINKS` in `site.ts`.
- **Colours, fonts, spacing** — `styles/tokens.css` (CSS variables).

**Stylesheet order matters.** `styles/index.css` lists the files in the order
they were in the original single stylesheet, and some rules rely on it (a
section's `padding-top` is set again in a media query after the shared page
section rule). Add new files at the end of the right group; don't alphabetise.

**Motion** — sections fade in as they scroll into view (`components/reveal.tsx`).
The hidden starting state only applies once the `js` class is on `<html>`
(inline script in `index.html`), so the page is fully readable without
JavaScript, and `prefers-reduced-motion` turns the animation off in
`styles/base.css`.

## Commands

```
npm install
npm run dev       # http://localhost:5184
npm run build     # type-check, build, prerender → dist/
npm run preview   # serve dist/ to check the built page
```

## Deploy

`.github/workflows/deploy-website.yml` runs `npm ci && npm run build` and
uploads **`website/dist`** to `$DEPLOY_PATH/website` on the server, which the
`website` nginx container mounts read-only (`deploy/server/docker-compose.yml`).
Two things to keep in mind:

- The upload must not use the scp action's `rm: true` — it would delete the
  directory the container has bind-mounted.
- Nothing removes old files on the server, so previous builds' hashed files
  in `assets/` stay behind. They are small and unreferenced; clear them by
  hand now and then if it bothers you.
