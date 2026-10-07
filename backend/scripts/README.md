# Scripts

One-off and occasionally-repeated operational tasks that are too specific to
be an API endpoint: importing scraped content, backfilling media, one-time
data fixes. Anything here can be run again safely — **idempotent and
resumable** is the bar, the same way the old data-pipeline jobs were. A
finished script exits quickly doing nothing on a second run; a killed one
picks back up rather than starting over or duplicating rows.

Run everything from `backend/`:

```bash
node scripts/<name>.js
```

## Content import (Bhagavad Gita, Srimad Bhagavatam)

The scraped scripture text lives in S3, in the **previous** project's bucket
(`sanatan-db`), not this project's own media bucket (`hariharibol-media`,
config'd via `S3_BUCKET`). It has its own credentials, kept separately on
purpose — this bucket is a one-time migration source, not part of the app's
regular configuration, so it does not belong in `.env`.

Copy `.env.scripts.example` to `.env.scripts` and fill in the three `SOURCE_*`
values — every `import-*.js` script loads it automatically (see
`lib/source-s3.js`), the same way the app loads its own `.env`. Real
environment variables, if already set, win over the file, so a server can
supply them from its own secrets manager instead of a checked-out file.

Locally, those three values are sitting in
`../hariharibol-local-secrets/backend/.env` from the previous project — copy
them from there. On a server, get them the same way you get any other secret
for a one-time job.

Only **Vaishnav-sampradaya, devotional** commentators are imported — see
`lib/translators.js` for the approved slug list and why each one not on it
(Shankaracharya, Sivananda, Ramsukhdas, …) is skipped rather than added. That
list is the same content-scope decision already encoded in
`prisma/seed/data.js`'s `translators` array; it is not this script's call to
widen it.

- `import-bg.js` — Bhagavad Gita: all 18 chapters, Sanskrit, Prabhupada's
  translation and purport, three Sanskrit commentaries (Ramanuja, Madhva,
  Sridhara Swami), and Dnyaneshwari's Marathi ovis.
- `import-sb.js` — Srimad Bhagavatam: cantos 1–12, Prabhupada's translation.
  Cantos 1–9 have no Devanagari in the source; cantos 10–12 do.
- `repair-verse-source.js` / `repair-bg-source.js <srcDir> <outDir>` — check the
  scraped JSON against vedabase.io (BBT text) and write a corrected copy: SB
  compounds and whole verses the scrape dropped, SB chapter titles, Gita
  translations that were split or misplaced, the "There is no purport"
  placeholder. Work on a local download of the bucket; nothing is written to S3
  or the database.
- `upload-verse-source.js <dir> --yes` — puts that corrected copy into the
  bucket. The bucket has no versioning, so it first copies every object it will
  replace to `json-backup-<date>/` and checks each copy.
- The importers **correct** existing rows when the source differs (not just add
  new ones), so after a source repair, running `import-bg.js` then
  `import-sb.js` on the server is what brings the live database up to date.
  `SOURCE_LOCAL_DIR=<dir>` makes them read a local copy instead of S3.
- `set-book-cover.js <book-slug> <path-to-image>` — sets one book's cover
  image. Uploads through `services/s3.js`, so it lands on S3 in production and
  under `storage/` locally, same as everything else that service handles.

## Legacy media migration (callvcal bucket)

The previous project's actual media — audio, images, video — lives in a
different bucket again (`callvcal`, under the `ramkrishnahari/` prefix), not
`sanatan-db` (that one is scripture text, see above) and not this project's
own `hariharibol-media`. Same reasoning as the content import: separate
credentials that are a one-time migration source, not app configuration, so
they get their own gitignored env file rather than living in `.env`.

Copy `.env.legacy-media.example` to `.env.legacy-media` and fill in the
`LEGACY_*` values — `import-legacy-media.js` loads it automatically (see
`lib/legacy-media-s3.js`).

`import-legacy-media.js` copies every object under the old prefix into this
app's own bucket (`services/s3.js`), under `legacy/<original path>` — it does
not try to guess which mantra, verse or book a file belongs to, it only
relocates the bytes. Idempotent and resumable: a destination key that already
exists is left alone. Run `node scripts/import-legacy-media.js --dry-run`
first to see what is there and confirm the credentials work before copying
anything for real.

Note that `services/s3.js` itself falls back to `backend/storage/` when the
app's own `.env` has no AWS credentials configured (see "Local media" below)
— so without real `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in `.env`, a
real run lands files on local disk instead of the actual new bucket.

## Verse–mood links

`seed-verse-issues.js` — hand-curated `VerseIssue` rows for the six mood
chips on the home tab (kama, krodha, lobha, moha, mada, matsarya). Every
entry is checked against a primary source (Śrīla Prabhupāda's
Bhagavad-gītā As It Is / Śrīmad-Bhāgavatam) before being added — see the
comment at the top of the file. Unlike the AI batch pass
(`jobs/processors/ai.js`), which proposes links at scale and needs review,
this is a short, sourced list meant to be trusted as written.

Depends on `import-bg.js` / `import-sb.js` having already loaded the verse
content, and `npm run seed` having loaded the issue taxonomy. Run with:

```
npm run seed:verse-issues
```

## Local media

`services/s3.js` falls back to `backend/storage/` when no AWS credentials are
set **and** `NODE_ENV` is `development` — real S3 credentials, or a
production environment, always win. Nothing about the scripts changes either
way; they call the same `services/s3.js` functions regardless of which mode
is active.
