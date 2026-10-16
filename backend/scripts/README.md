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
- `fill-prabhupada-source.js [--only bg,sb:3] [--upload]` — fills the source JSON
  from Prabhupada's own text on vedabase.io (BBT), and nothing else: the Gita's
  word-by-word (the source had none), the Bhagavatam's Devanagari for cantos 1–9
  (it never had it), clean word-by-word for cantos 10–12 (the source's has each
  verse's translation and purport pasted into its last entry), and any Prabhupada
  translation, purport or transliteration a verse lacks. Built to run for an hour
  or two in the background and be stopped and started again — scraped pages are
  cached in `.fill-work/`, finished chapters are skipped (`--redo` repeats them).
  `npm run fill:status` shows progress from another terminal (bar per book, what
  was added, what is uploaded, every verse that could not be filled and why).
  `--upload` backs up each chapter's objects to `json-backup-<date>/`, checks the
  copy, replaces the object and checks what landed, **as soon as the chapter is
  done**; without it nothing leaves the machine. A fill is only written if it
  changes nothing that was already there, and a page is accepted as a verse only
  if it matches that verse's own text. The rules are in `lib/fill-verse.js`
  (`npm test` covers them); a Gita chapter's word-by-word is cut by the Sanskrit's
  verses, not the BBT's, because the two end verses in different places.
  The filled copy is `.fill-work/source/`: point the importers at it with
  `SOURCE_LOCAL_DIR` to check it locally before (or after) it is uploaded.
- The importers **correct** existing rows when the source differs (not just add
  new ones), so after a source repair, running `import-bg.js` then
  `import-sb.js` on the server is what brings the live database up to date.
  `SOURCE_LOCAL_DIR=<dir>` makes them read a local copy instead of S3.
- `set-book-cover.js <book-slug> <path-to-image>` — sets one book's cover
  image. Uploads through `services/s3.js`, so it lands on S3 in production and
  under `storage/` locally, same as everything else that service handles.
- `sloka-card-preview.js [verse-id …]` — draws the daily sloka push's picture
  for some verses (a spread of short, long and compound ones when none are
  named) into `storage/sloka-card-preview/`. Uploads nothing and sends nothing;
  see "The daily sloka push" in `../CLAUDE.md`.
- `sloka-push-demo.js <email> [verse-id …]` — sends the daily sloka push for
  some verses (the preview's spread when none are named) to that person's own
  devices, six seconds apart. Builds each push the way the hourly job does, but
  writes no Notification row and marks no sloka delivered. Needs Firebase
  credentials; draws and stores each verse's picture in the media bucket first.
- `recount-books.js [--dry-run] [book-slug …]` — rebuilds the verse, chapter and
  canto counts from the rows that are there. See "Counts" below.

### A new database, start to finish

```bash
npx prisma migrate deploy     # the schema
npm run seed                  # roles, languages, issues, plans, settings, the books and their cantos
node scripts/import-bg.js     # the Gita's chapters and verses
node scripts/import-sb.js     # the Bhagavatam's chapters and verses
npm run seed                  # again — the stories point at the chapters just imported
```

The seed makes the books and cantos but not their chapters or verses; the importers
do. Stories point at chapters, so on a database with no chapters yet the first
seed prints "4 stories wait for chapters that are not imported yet", finishes
everything else, and the second run creates them. Every step is idempotent, so a
step run twice does no harm, and an importer run before the seed stops with a
message that the book row is missing. On the server, run each through the api
container: `docker exec hariharibol-api node scripts/import-sb.js`.

### Counts

A chapter's verse count, a canto's chapter and verse counts and a book's totals
are what the reading screens show. They are **rebuilt from the rows by
`services/book-counts.js`, never copied from a file**: at the end of both
importers, and by the admin panel whenever a verse, chapter or canto is added
or removed. (Copying `meta.totalVerses` out of the source JSON is what left 134
chapters of Bhagavatam cantos 10–12 showing "0 verses" — those files carried no
total.) A recount writes only the rows that are wrong, so a healthy database
comes back "All counts correct".

```bash
npm run recount:books                       # fix whatever is wrong, every book
npm run recount:books -- --dry-run          # say what would change, write nothing
npm run recount:books -- srimad-bhagavatam  # just this book
```

`npm run test:book-counts` walks it against a running API.

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

**The trap in that fallback:** a file saved under `backend/storage/` exists on
that machine only, while the database stores just its key (`books/covers/…`,
`deities/images/…`). A database copied to a server brings the keys and none of
the files, and nothing complains until a phone asks for the image — the signed
link is made without checking that the object exists. So before moving a database
that was built locally, make sure each key it names is in the bucket (a HEAD
request per key shows the gaps), and upload the missing files without overwriting
what is already there. The seed names deity images but does not upload any.

## Translating the Gita with Claude

`translate-claude.js` translates Prabhupāda's Gita into **Marathi, Hindi and Tamil** (default `--langs hi,mr,ta`;

Flags added for several providers and both books: `--provider openai|anthropic|gemini` (default OpenAI `gpt-6-luna`, key `OPENAI_API_KEY`, model override `TRANSLATION_OPENAI_MODEL`; `--provider anthropic` for Claude `claude-sonnet-5-5`, key `ANTHROPIC_API_KEY`, for what Luna scores 1; Gemini `gemini-3.5-flash-lite`, key `GEMINI_API_KEY`) and `--book bhagavat-gita|srimad-bhagavatam`. For the Bhagavatam `--chapters` takes canto×100+chapter (`1047` = SB 1.47) and `--verse` takes an id like `2.1.47.3`.
all seven app languages are available) with an AI model (GPT-6 Luna by default; Claude and Gemini are options), one verse at a time, saving each verse to S3
before the next begins. It is standalone (not `services/ai/`) and independent of the Gemini plan in
`translate-verses-PLAN.md`.

**The same pipeline also runs from the admin panel.** The **Translations** page (Content → Translations) picks
a language, shows an estimate, starts the run as a BullMQ job in the worker container, and follows it live over
the websocket — progress, a spend counter, an activity feed, and a reader that shows the saved verses beside the
English. It survives a page refresh, pauses (and Resumes) on out-of-credit or a bad key, retries on its own when
Anthropic is busy, and keeps every verse already saved. It writes the same files, with the same scores, as this
script. See "Translation runs" in [../CLAUDE.md](../CLAUDE.md). **Use one or the other for a language at a time**:
if the worker is working a run, do not start the command line for that language.

**What is sent:** only Prabhupāda — his English translation and purport, the verse's Roman transliteration
and its word-by-word list (each Sanskrit word in Roman letters with its English meaning), read from the
`en/` and `sa/` chapter files. Never the Devanagari verse or Sivananda's (or anyone else's) text.
**What comes back, per language — four items per verse:**

1. `translation` — the meaning
2. `transliteration` — the verse in that language's script, same number of lines as the Roman one
3. `wordMeanings` — `[{ word, meaning }]` in the same order: the word in the script, the meaning translated
4. `purport` — paragraph for paragraph

**The goal is Prabhupāda's words, as they are.** The instructions tell Claude to add nothing, drop nothing
and explain nothing — no other author's words, no commentary — and also that the result must be
grammatically perfect, natural and respectful to a native reader (honorifics and forms of address as a devout
speaker of that language would write them). Sanskrit terms and names are transcribed into the language's
script, not translated.

**Every verse is accepted, and every item has a correctness score, 1 to 3.**

| score | meaning |
|---|---|
| **3** | perfect — complete, faithful, grammatical, respectful |
| **2** | good — complete, but a wording or a term is doubtful |
| **1** | needs a second round — something is missing or wrong |

Each part (`translation`, `transliteration`, `wordMeanings`, `purport`) gets a score, and the verse's
`correctness` is the lowest of its parts. A part's score is the lower of two things: **Claude's own rating**
of it (asked for in the same answer, with a one-sentence `note` when anything is below 3) and **the free
checks the script runs** — a missing paragraph, a text far shorter than the English (not measured under 15
English words; the floor is 30 % lower under 150), a list or transliteration of the wrong length, English left
in, a wrong number, the wrong script, a code point Unicode has not assigned (an avagraha the model wrote as U+0BC3 in Telugu), Hindi written for Marathi (these cap the part at 1); unmatched
brackets or quotes, a line break, a text noticeably too long (these cap it at 2). The checks can lower what
Claude said but never raise it. A part the English does not have (a verse with no purport) is not scored.

**All four items are asked for every time, and an answer is not rejected for looking incomplete.** An answer
that comes back is saved as it is, with the findings as `aiTranslation.warnings` and the lower score. Two
kinds of answer are asked again, for that language alone, with the reason: one with nothing to save (invalid
JSON, or no translation text), and one that leaves a **whole item out** — the English has a purport, a word
list or a transliteration and the answer has none (empty, or blank entries). If every round (`--max-rounds`)
leaves the item out, the best answer is saved without it and that item is scored 1, so the verse shows up in
the `--status` second-round list; the file's own text for it (the Roman transliteration in `hi/`) is not
blanked. A short purport, a missing word entry, English left in are warnings and a 1, not a re-ask.

**Where it lands.** The same layout as the English (`en/`) and Sanskrit (`sa/`): **one file per language per
chapter**, `sanatan-db/json/bhagavat-gita/<lang>/ch-<n>.json` — `hi/ch-2.json`, `mr/ch-2.json`,
`ta/ch-2.json`. Nothing is named after Claude. A verse in it has the same shape as in the English file:

```jsonc
{ "verseId": "1.2.47", "globalVerseNumber": 87, …,
  "transliteration": "कर्मण्येवाधिकारस्ते …",            // 2. in this language's script
  "wordMeanings": [{ "word": "…", "meaning": "…" }],      // 3.
  "commentaries": [                                       // 1. and 4., Prabhupāda's rows
    { "translatorSlug": "prabhupada", "type": "translation", "language": "mr", "displayOrder": 1, "text": "…",
      "translatedBy": "claude", "version": "1.0-12-10-26", "correctness": 3 },
    { "translatorSlug": "prabhupada", "type": "purport", …, "translatedBy": "claude", "version": "1.0-12-10-26", "correctness": 2 } ],
  "aiTranslation": { "translatedBy": "claude", "version": "1.0-12-10-26", "model": "claude-sonnet-5-5", "effort": "off",
                     "promptVersion": "6", "sourceHash": "…", "generatedAt": "…",
                     "correctness": 2,                                        // the lowest part
                     "partScores": { "translation": 3, "transliteration": 3, "wordMeanings": 3, "purport": 2 },
                     "note": "…",                                             // only when Claude had a doubt
                     "warnings": ["purport: rated 2 by Claude"] } }
```

The score is on **every `commentaries` row** (its own part) and on the verse (`aiTranslation.correctness`, the
lowest part, with each part in `partScores`), so a row read on its own still says how far to trust it. The
verse-level `transliteration` and `wordMeanings` have no row of their own; their scores are in `partScores`.

**Version.** `TRANSLATION_VERSION` in `backend/.env` (default `1.0-12-10-26`) is fixed for a run and written
on **every item**: each `commentaries` row and the verse's `aiTranslation`. Change it before a later
re-translation and the old and new verses can be told apart (and compared, with `--status`, which lists the
versions found per language). The checkpoint is per version too.

**A language already translated under the current version is not translated again.** A verse is *current* when
Prabhupāda's translation exists and its `aiTranslation.version` is this run's version, or it has no
`aiTranslation` (a person's text, which a run never replaces). A verse under any other version, older or newer,
is *outdated* and is translated again; a missing one is translated. So the same command run twice does nothing
the second time (`--dry-run` and the admin page both say "up to date"), and a new `TRANSLATION_VERSION` is how you
ask for everything to be redone.

**An existing language file is merged into, never replaced.** `hi/ch-N.json` already exists (other translators'
rows and a Roman `transliteration`). A run keeps every other row and verse, replaces only Prabhupāda's rows
of that language, adds new rows after the last `displayOrder`, and replaces the verse-level `transliteration`
with the one in the script. Before the **first** change to a file that was not written by this script, an exact
copy goes to `json-backup-<date>/json/bhagavat-gita/<lang>/ch-<n>.json` (checked, and an earlier backup the
same day is kept). Every write is conditional on the object not having changed since it was read (S3
`If-Match` / `If-None-Match`), and is read back and compared before the run moves on.

**Setup**

1. Put a key in `backend/.env`: `OPENAI_API_KEY=…` for the default (GPT-6 Luna; `TRANSLATION_OPENAI_MODEL` is optional), or
   `ANTHROPIC_API_KEY=sk-ant-…` for `--provider anthropic` (`ANTHROPIC_MODEL` is optional; default `claude-sonnet-5-5`);
   `TRANSLATION_VERSION` as above. The script never prints a key.
2. The English is read from, and the output written to, the bucket in `.env.scripts` (`SOURCE_*`) — the
   same bucket as the app's `S3_BUCKET`. Those credentials must be allowed to **write** under
   `json/bhagavat-gita/` and `json/reports/`, and to copy to `json-backup-*/`; the first checkpoint write
   checks the bookkeeping permission before any Claude call is paid for. (The admin page needs none of this:
   the server uses its own `S3_BUCKET` and AWS keys.)

**Commands** (run from `backend/`)

| | |
|---|---|
| `npm run translate:claude:dry` | what is left per language, calls, tokens, estimated cost. Calls nothing, writes nothing |
| `npm run translate:claude:status` | saved verses per chapter and language, versions found, last verse, total spend. `-- --verify` re-checks every saved verse against the English |
| `npm run translate:claude:test` | **one** random verse (or `-- --verse 2.47`), all languages, written under `_test/<time>/` in the bucket and printed in full. The real chapter files are not touched. Do this first and read it |
| `npm run translate:claude -- --chapters 2 --limit 3` | a small real pilot |
| `npm run translate:claude` | everything; resumes by itself at the first verse and language not saved |

Other flags: `--verse 1.2.47`, `--langs hi,mr,bn,ta,te,kn,ml`, `--model`, `--effort`, `--group-budget`,
`--max-spend <usd>`, `--max-tokens`, `--max-rounds`, `--local-store <dir>` (write to a folder laid out like
the bucket, not S3), `--force`. `--help` lists them all. A language added later (`--langs ta` after hi and mr
are done) translates only that language.

**Finding the verses that need a second round.** `npm run translate:claude:status` prints, per language, how
many saved verses scored 3, 2 and 1 (and how many have no score), and lists the verses scored 1. There is no
second-round pass yet (it was left out on purpose); the list is what one would work from.

**Thinking is off.** Translation needs no reasoning, and thinking tokens are billed as output. The way to turn
it off differs by model, so the script chooses: Sonnet 5.5 (the default) takes `thinking: between_tools`,
its lowest setting, which with no tools means a plain text answer; Sonnet 5, Opus 5 and Haiku 5.5 take
`disabled`; the 4.x models are sent nothing. **Opus 5.5, Fable and Mythos cannot turn thinking off** — the
script says so before any call and suggests `--effort low`. Any other `--effort` lets the model think at that
level, which costs more and uses up `--max-tokens`.

**How it runs.** Verses go in order, one at a time, and each is saved before the next begins. **Each language
of a verse is written in a call of its own** (so a verse is three calls for hi, mr, ta) and the verse is saved
once all of them are in. Claude's answer is **accepted as written** (see above). The prompt asks for it right
the first time; there is no checking round. An answer with nothing to save is asked again for that language
alone, with the reason, up to `--max-rounds`; after that the run **stops** on the verse (nothing of it is
written in any language). An answer that left a whole item out is asked again the same way, but after the
last round it is saved with that item missing and scored 1 rather than stopping the run. A call that runs out of `--max-tokens` is a hard error for a single language
(raise `--max-tokens`). A refusal or a 400/401/403 also stops it. 429 / 5xx / network errors wait and retry. Ctrl-C
stops cleanly. After a hard kill the checkpoint still says "running" for 20 minutes; pass `--force` to start
sooner. The log is `backend/.translate-work/claude.log` (ids, languages, tokens, scores, warnings, errors —
never the model's text). Done is read from the chapter files themselves, so the checkpoint
(`json/reports/translate-bhagavat-gita-<version>.json`: totals, last verse, last error, spend) is only a summary.
`--status --verify` re-checks every saved verse strictly (any finding, even a minor one, is reported) and that
its scores are present and agree.

**Cost.** `--dry-run` estimates about **$51** for all 701 verses × hi, mr, ta (~2,100 calls) on Sonnet 5.5 with thinking off
($2 per million tokens in, $10 out; the instructions, ~2,400 tokens, ride on every call and are priced at the
cached rate, $0.10). Almost all of it is output (~4.7M tokens). The token-per-word figures are estimates —
read the real spend after the pilot; `--max-spend` stops the run before the next verse once it is reached.
Spend is recorded in the checkpoint and per-verse log, **not** in `AiUsageLog`.

**Why one language per call.** The output is the same either way, so the time is the same (the run is
sequential) and one call per language costs only about 5% more — the English is sent again for each language
and the instructions are read again from the cache. It was chosen because a language cannot lean on the one
written just before it in the same answer (Marathi after Hindi shares a script and many words), the last
language of a long answer (Tamil) is less likely to be shortened, and a failed call loses one language, not
three. (That is reasoning, not a measurement; read a sample.) `--group-budget 40000` puts a verse's languages
together in one call again (~706 calls, ~$48): languages share a call while their estimated output fits the
budget, and a verse too large for it splits.

**Batch API.** Anthropic's Message Batches API is half price ($1 in / $5 out on Sonnet 5.5; most batches finish
within an hour, 24 hours at most), which would bring this to roughly $25–30. It is **not built**: it needs a
submit / poll / collect step and gives up the verse-by-verse, saved-before-the-next behaviour above.

**Getting it into the database.** The saved files are laid out like `en/ch-N.json`: the same `meta`, the same
verse fields, `transliteration` as one string (lines joined by a line break), Prabhupāda's translation and
purport as `commentaries` rows (`translatorSlug`, `type`, `language`, `displayOrder`, `text`; a purport's
paragraphs joined by a line break), and `wordMeanings` as `[{ word, meaning }]` — the list `lib/word-meanings.js`
already expects. **The admin Translations page's Import button** (`services/translation-import.js`; see
"Translation runs" in [../CLAUDE.md](../CLAUDE.md)) copies each language's files into the database. It is not
`import-bg.js`, which still reads only `sa/`, `en/` and `dnyaneshwari/mr/`. All four items go in:

| in the file | goes to (`VerseTranslation`, translator `prabhupada`, the language, type `TRANSLATION`) |
|---|---|
| translation `commentaries` row | `meaning` |
| purport `commentaries` row | `purport` |
| `transliteration` | `transliteration` — the verse in that language's script |
| `wordMeanings` | `wordMeanings` — `[{ word, meaning }]`, null when the verse has none |
| `aiTranslation` | `translatedBy` and `version` — which run made the text. `translatedBy` is the provider's brand (`claude`, `gpt` or `gemini`); the model is in the stamp |

They sit on the translation row, **not** on `Verse`: `Verse.transliteration` and `Verse.wordMeanings` are single,
language-neutral columns holding the Roman text and the English meanings, and copying Hindi, Marathi or Tamil into
them would overwrite those. An import never touches `Verse`.

A verse is found by its place in the book — `verseId` inside the book, and the file's book, canto, chapter and
verse numbers must agree with the row's — so the row that is there is **replaced in place** (same `id`,
same `createdAt`, same unique key `verseId + translator + language + type`) with what the file says. A part the file
no longer has is cleared; a row that already matches is not written. New rows are hidden from readers unless the
import is asked to make them visible. Re-doing a verse with a new version overwrites it in place in its language
file and, on the next import, in the database (the earlier text survives only in the dated backup); keeping both
versions side by side would need a history field. **The app does not read the new columns yet.**

**Review.** The checks catch structure, omissions and wrong script, not reverence or subtle meaning, and
Claude's own 3 is only as reliable as its sense of the language. A native reader should review a sample per
language — Tamil especially — and the verses scored 1 or 2, before this goes in the app. **Not yet run live:**
no real call has been made with this version; start with `npm run translate:claude:test`.
