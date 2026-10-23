# Devotee etiquette — progress and handoff

Last updated 2026-10-23 (session 3 finished "Unfinished from session 2": the regex fix, the e2e author coverage, all four docs, and the full verification run all passed; only the optional memory update and this file's own history are session 3's own additions). Delete this file once the feature is merged; the lasting notes are in the four CLAUDE.md files (see "Docs").

## Goal (the original request)

A second daily section beside the sloka, which stays as it is: **Devotee etiquette**, for every devotee.

- One push a day at **07:15** with one etiquette item, and a well-spaced section in the app.
- Content from official or reputable sources; etiquette that harms faith in any god is **kept in the database but never shown or pushed**.
- An English backend seed, Prisma schema and migration, an admin page to view and manage items.
- Admin-driven **translation runs**, built like Scenes and book Translations.

## Status at a glance

| Part | State |
|---|---|
| Backend | Built. Schema, migration, seed (95 items), app and admin APIs, daily push job, translation runs. The `20261107000000_etiquette_author` migration is **applied to the scratch database** and the Prisma client regenerated. Unit tests **60/60** (46 + 14, the regex fix included). E2E **114/114** (106 + 8 new author/seed checks). |
| Admin | Done, including the Author column and the required Author field. `tsc -b` clean and `vite build` passed after the author work. **Not driven in a browser.** |
| App | Done, including the author line on the source card. Analyser clean for the etiquette files; `test/etiquette_test.dart` (14) and `test/l10n_parity_test.dart` pass (129 tests in the two files). **Not run on a phone or against a live API.** |
| Docs | All four `CLAUDE.md` files (root, backend, admin, app) now describe the feature with the author, the fill-missing rule and the current counts. |
| Commit | **Nothing is committed.** Do it only when asked (see "If asked to commit"). |

## Session 2 — source audit and author names (written, not finished, not committed)

Two jobs were done after the first build. The files are all in the working tree; the backend tests, the e2e walk and three docs are still to do (next section but one: "Unfinished from session 2").

### 1. Source audit — done

The old "Not verified" bullet said some references went further than the page they cite. Every one of the 95 items was checked: the cited page was fetched and read, and the item's rule has to be supported by it. Links are live and the Vedabase references match. Where a page did not support a detail, the seed wording was cut back to what it does support (only the rule is taken from a source, never its sentences). A new source key `noi5` was added in `backend/prisma/seed/etiquette/sources.js`.

Wording changed on 16 items (slugs):

- `temple.js`: `come-to-the-temple-clean`, `dress-modestly`, `leave-your-shoes-outside`, `fold-your-hands-in-puja`, `leave-the-sanctum-to-the-priests`
- `deity.js`: `offer-what-is-fresh-in-season`
- `prasad.js`: `offer-before-you-eat`, `accept-prasada-with-gratitude` (title now "Accept prasāda with reverence"), `share-what-you-have`, `wash-after-eating-before-worship`
- `speech-mind.js`: `tolerate-provocation` (the tree image removed)
- `guru-vaishnava.js`: `do-not-disregard-your-teacher`, `be-humble-and-patient` (title now "Be patient in your practice"), `seek-guidance-from-seniors`
- `holy-places.js`: `keep-the-holy-place-clean-and-pure`, `look-after-your-belongings`

**Limit to remember.** The Hindu Temple of Atlanta page was verified only through WebFetch quotes. Claims it did not support were moved to the Sydney, BAPS London or Banke Bihari pages, or removed: washing hands and feet, covered shoulders, carvings, thanking, eating on the move, holy water, the meaning of clockwise, feet toward the Deity, phones and photography, sitting after puja. Its vegetarian credit is confirmed.

The first audit pass missed small embellishments inside otherwise sound items; they were found on a second read. If more sources are added, read for detail, not only for the rule.

Validator after the audit: `items 95 published 93 excluded 2 problems 0`.

### 2. An author on every item — written, partly verified

User's request, verbatim: "make sure there is author name for each etiquette, if comes from our two 2 books we can mention verse".

**Decision: the book author's name is not used.** `HIDDEN_NAME = /prabhup/i` in `prisma/seed/etiquette/index.js` (line ~51) makes `checkItems` refuse it in any text field, and `AppConfig.showAuthorName` plus the website's `SHOW_AUTHOR_NAME` are both false on purpose until the owner has permission (memory `project_prabhupada_name_hidden`). So "author" is a name the rule allows:

- the verse's speaker or composer: Śrī Kṛṣṇa, Lord Kapila, Nārada Muni, Rūpa Gosvāmī, Śrī Caitanya Mahāprabhu;
- the scripture the page names: Padma Purāṇa, Varāha Purāṇa, Brahma-saṁhitā, "Vedic scripture";
- the teacher or temple that published the page: Bhakti Charu Swami, Saci Gaurasundara Dasa, Hindu Temple of Atlanta, Sri Venkateswara Temple Sydney, BAPS Shri Swaminarayan Mandir London, Shri Banke Bihari Mandir Vrindavan.

For an item from Bhagavad-gītā or Śrīmad-Bhāgavatam the verse is already in `reference` ("Bhagavad-gītā 9.26", "Śrīmad-Bhāgavatam 7.11.8–12") and the source card shows it right under the author. Items from the Nectar of Devotion show "Vedic scripture", "Varāha Purāṇa" or "Brahma-saṁhitā". **To show the book author's name later:** add it to the `by` table in `sources.js`, relax `HIDDEN_NAME`, and flip `showAuthorName` and `SHOW_AUTHOR_NAME` together. The label reads "Author", the user's own word.

What changed:

- **Schema.** `Etiquette.author String? @db.VarChar(200)` after `sourceUrl`. Migration `backend/prisma/migrations/20261107000000_etiquette_author/migration.sql` (`ALTER TABLE "Etiquette" ADD COLUMN "author" VARCHAR(200);`). **Not applied anywhere; the Prisma client is not regenerated.**
- **Seed.** `sources.js` has a `by` table of 15 names and `names(...list)` (joins with "; "). All 95 items carry an explicit `author:`. `index.js`: `author` is required, at most 200 characters, in `REFRESHED` (rewritten on unedited rows); an `isEdited` row with no author gets the seed's author and counts as `updated`, its other edits stay.
- **Backend.** `utils/etiquette.js` `present()` returns `author` (null when empty); `controllers/admin/etiquette.js` list `select` and `create` carry it (`update` spreads the body); `routes/admin/etiquette.js` POST and PATCH take `author: optionalText(200)`.
- **Admin.** `src/lib/etiquette.ts`, `src/routes/etiquette.tsx` (Author column), `src/components/etiquette-item-dialog.tsx` (Author field, **required on a new item**, sent on create, diffed on edit), `admin/CLAUDE.md`. An old item with no author has to be given one before an edit saves.
- **App.** `lib/models/etiquette.dart` (`author`), `lib/widgets/etiquette/etiquette_source_card.dart` (Author first, then Reference, then Source; draws nothing only when all three are empty), key `etiquetteAuthorLabel` in all 12 ARBs (before `etiquetteReferenceLabel`) and `lib/l10n/generated/`, `test/etiquette_test.dart` (14 tests). Translations of the label, AI-drafted: as/bn লেখক, gu લેખક, hi/mr लेखक, kn ಲೇಖಕ, ml രചയിതാവ്, or ଲେଖକ, pa ਲੇਖਕ, ta ஆசிரியர், te రచయిత.
- **Backend unit test.** `test/etiquette.test.js` edited (fixture has an author; `present` test; four author faults in the `checkItems` test; two seed tests). **Written, never run.**

Author, reference and source stay English only (`EtiquetteTranslation` covers title, summary and body).

Verified in session 2: seed validator 95 / 93 / 2 / 0 problems; `npm run build` in `admin/`; `tool/flutter.sh analyze` on the etiquette model, widget and test (no issues); `tool/flutter.sh test test/etiquette_test.dart test/l10n_parity_test.dart` (129 passed).

## How it works

**Content.** 95 items in `backend/prisma/seed/etiquette/` (nine category files, `sources.js`, `index.js`): 93 `PUBLISHED`, 2 `EXCLUDED` (each with an `excludedReason`; they set Śiva/Brahmā equal to or independent of Viṣṇu, or treat chanting "Kālī"/"Durgā" as equal to Hare Kṛṣṇa). Wording is original; each item has a `reference`, an `author` and a `sourceName` / `sourceUrl`. `checkItems` rejects text naming the author (`AppConfig.showAuthorName` is false). Purity rules (menstruation, death) were deliberately left out. A non-published item is a 404 in the app API. The seed is idempotent and leaves `isEdited` rows alone.

**Daily push.** Cron `etiquette.deliver` (`backend/config/cron.js`, queue `notification`, every 15 minutes) → `backend/jobs/processors/etiquette-deliver.js`. A reader is sent one when their local time reaches setting `etiquette.delivery.time` (default `07:15`, must be a multiple of 15). `EtiquetteDay` holds one shared item per date (least recently used; replaced if un-published later). `EtiquetteDelivery (userId, date)` is unique, so a repeat run cannot send twice. Title "Hari Bol <first name>" in the reader's *reading* language (the saved rule: never "Hi"/"Dear"); body is title + summary clipped to 220; data `{deeplink: 'hariharibol://etiquette/<id>', etiquetteId, category}`; type `NotificationType.ETIQUETTE`.

**Translation runs.** `EtiquetteRun` row is the truth; BullMQ queue `etiquette` (`attempts: 1`) works it. A run translates one language's published items that have no translation (all with `force`). **A translation an editor wrote by hand is never replaced, with or without `force`** (`services/etiquette.js` `itemsToTranslate` / `saveTranslations`). Websocket events `etiquette.run` / `etiquette.activity` go to `etiquette.translate`. Languages: hi mr gu bn ta te kn or pa ml as.

**App.** Home card → `/etiquette` (today's item on top, category bar filtering on the phone, only categories that have a published item) → `/etiquette/:id` (full text, source card with reference / name / URL as selectable text). Push deeplink `hariharibol://etiquette/<id>` (bare `etiquette` opens the list).

**Permissions** (both granted to `admin` and `super_admin` by the migration): `etiquette.manage` (items, hand-edited translations), `etiquette.translate` (estimate and runs).

## API

App (`/api/app/etiquette`): `GET /today`, `GET /?category=`, `GET /:id` — all take `languages`.

Admin (`/api/admin/etiquette`): `GET /overview`, `GET|POST /items`, `GET|PATCH /items/:id`, `POST /items/:id/status`, `PUT|DELETE /items/:id/translations/:language` (manage); `GET /estimate`, `GET|POST /runs`, `GET /runs/:id`, `POST /runs/:id/resume`, `POST /runs/:id/cancel` (translate).

## Files

Everything below is new unless it says *edited*; other features' hunks share the edited files (see "Working tree").

- **Backend**: `prisma/schema.prisma` (*edited*) and `prisma/migrations/20261103000000_devotee_etiquette/`, `prisma/migrations/20261107000000_etiquette_author/`; `config/etiquette.js`, `config/{constants,cron,maintenance}.js` (*edited*); `utils/etiquette.js`; `utils/messages.js` and `locales/*.json` (*edited*); `services/etiquette.js`, `services/websocket.js` (*edited*); `jobs/processors/{etiquette,etiquette-deliver}.js`, `jobs/processors/notification.js`, `jobs/index.js`, `worker/index.js` (*edited*); `prisma/seed/etiquette/`, `prisma/seed/{data,index}.js` (*edited*), `scripts/seed-etiquette.js`; `controllers/admin/{etiquette,setting}.js`, `routes/admin/etiquette.js`, `routes/admin/index.js` (*edited*); `controllers/app/etiquette.js`, `routes/app/etiquette.js`, `routes/app/index.js` (*edited*); `package.json` (scripts `seed:etiquette`, `test:etiquette`); tests `test/etiquette.test.js`, `test/messages.test.js`, `scripts/etiquette-e2e.js`.
- **Admin**: `src/lib/etiquette.ts`, `src/components/{etiquette-run,etiquette-item-dialog}.tsx`, `src/routes/etiquette.tsx`, `src/lib/nav.ts` and `src/router.tsx` (*edited*).
- **App**: `lib/models/etiquette.dart`, `lib/services/{etiquette_service,push_link}.dart`, `lib/providers/etiquette_provider.dart`, `lib/widgets/etiquette/*` (5 files), `lib/widgets/dashboard/etiquette_entry_card.dart`, `lib/views/etiquette/*` (2 files), `lib/views/dashboard/home_tab.dart`, `lib/core/constants/{api_paths,push_config}.dart`, `lib/core/navigation/{app_routes,app_router}.dart` (*edited*), 17 `etiquette*` keys in the 12 `app_*.arb` and the 13 generated l10n files, `test/etiquette_test.dart`.
- **Docs**: root `CLAUDE.md` (row "Devotee etiquette"), `backend/CLAUDE.md` ("## Devotee etiquette"), `admin/CLAUDE.md` ("## Devotee etiquette page"), `app/CLAUDE.md` ("## Devotee etiquette" and the rich-push bullet).

## What ran, and how to re-run it

All backend runs use a scratch database so the dev DB is never touched. **Always pass `DATABASE_URL` on the command line**, and blank the AWS and Firebase variables (the dev `backend/.env` points at real AWS).

```bash
cd "/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/backend"
# unit tests (no database)
node --test test/etiquette.test.js test/messages.test.js
# e2e (114 checks) — scratch DB, credentials blanked
DATABASE_URL=postgresql://teja@localhost:5432/hhb_etiquette_scratch AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= \
  GOOGLE_SERVICE_ACCOUNT_PATH= FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY= \
  node scripts/etiquette-e2e.js
# if the scratch DB lags migrations ("column ... does not exist"):
DATABASE_URL=postgresql://teja@localhost:5432/hhb_etiquette_scratch npx prisma migrate deploy
DATABASE_URL=postgresql://teja@localhost:5432/hhb_etiquette_scratch npx prisma generate
```

```bash
cd "/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/admin" && npx tsc -b && npx vite build
cd "/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/app" && tool/flutter.sh test test/etiquette_test.dart test/l10n_parity_test.dart test/push_link_test.dart
```

**Results on 2026-10-23 (session 3, the author work verified end to end):** `20261107000000_etiquette_author` applied to the scratch database and the Prisma client regenerated; the seed validator reported `items 95 problems 0`; unit tests **60 passed, 0 failed** (46 `etiquette.test.js` + 14 `messages.test.js`, the Unicode regex fix included); e2e **114 passed, 0 failed** (the original 106 plus 8 new checks: the created item's author is saved and read back from the admin API, an edit changes it, the app API carries it, `/today` carries it, and the seed fills in a missing author on an edited row while leaving its other edits standing); admin `tsc -b` and `vite build` both clean; app `tool/flutter.sh test test/etiquette_test.dart test/l10n_parity_test.dart test/push_link_test.dart` all green. `npm test` needs Node ≥ 21; under Node 20 run files one at a time.

Earlier (2026-10-22, before the author work): e2e **106 passed, 0 failed**; unit **58/58**; admin type-check and build clean. The e2e had been blocked for a while by three unrelated migrations the scratch DB lacked (`20261104000000_user_mantras`, `20261105000000_sakha_profile`, `20261106000000_user_location`); they are applied now.

Earlier (2026-10-22): app l10n generation identical to the committed files; 142 targeted app tests pass; the full app suite was 1485 pass / 10 fail, all in files this work did not touch (`glass_nav_bar_test` 2, `peacock_feather_icon_test` 1, `reading_audio_ui_test` 2, `reels_tab_test` 3, plus two time-of-day cases: `routine_check_test` "a task from before times were kept can be given one" fails after noon, `routine_test` "shows a strip of days with a tilak on Ekadashi" fails on an Ekadashi day). Eight of the ten also failed in a copy with the etiquette keys and test removed. **A clean-HEAD run was not made**, so this is evidence, not proof.

## Not verified

- No translation run has called a real provider; no push has left a machine; nothing has run on a phone or against a live API; the admin page has not been driven in a browser.
- The 11 translations of the 16 app strings, the nine category labels and the server wording for the push (`backend/locales/*.json`) are AI-drafted, not read by a native speaker.
- The source audit (session 2) is done, so the old doubt about references is closed, **except** that the Hindu Temple of Atlanta page was read only through WebFetch quotes (see "Session 2").
- The author work has now been run against a real scratch Postgres database and the full backend test/e2e suite (see "What ran"); it still has not run against a real AI provider, a phone or production.
- The `etiquetteAuthorLabel` translations (11 languages) are AI-drafted, like the other 16 strings.
- Whether the 10 failing app tests fail on a clean HEAD.

## Unfinished from session 2 — now finished in session 3

1. ~~**Fix a flaw in `backend/test/etiquette.test.js` (~line 427).**~~ **Done.** Changed to `/^(Bhagavad-gītā|Śrīmad-Bhāgavatam)(?=\s)/` and added assertions that both books are represented.
2. ~~**Edit `backend/scripts/etiquette-e2e.js`.**~~ **Done.** `author` is sent on create and changed on edit; checked back from the admin `GET /items/:id` and from the app `GET /etiquette/:id` and `/today`; a new section verifies the seed fills in a missing author on an `isEdited` row while leaving its other edits standing. Check count **106 → 114**.
3. **Docs — done**, all four files:
   - `backend/CLAUDE.md` "Devotee etiquette": `author` added to the column list; the Seed bullet now explains the author rule, the speaker / scripture / temple names in `sources.js`, and the fill-missing rule; the Tests bullet updated to "46 + 14" and "114 checks".
   - Root `CLAUDE.md` "Devotee etiquette" row: "an author on each" added; `20261107000000_etiquette_author` added to the production note; "114 checks".
   - `app/CLAUDE.md` "Devotee etiquette": notes the source card shows the author first; "16 new strings" → "17 new strings"; `test/etiquette_test.dart` (11) → (14).
   - `admin/CLAUDE.md`: already done in session 2.
   - This file: Status table, "What ran" and "Not verified" refreshed with the session 3 results.
4. **Run — done, all green.** Migration applied and client regenerated against the scratch database; seed validator `items 95 problems 0`; `node --test test/etiquette.test.js test/messages.test.js` → 60/60; `node scripts/etiquette-e2e.js` → 114/114; admin `tsc -b` + `vite build` clean; app `tool/flutter.sh test test/etiquette_test.dart test/l10n_parity_test.dart test/push_link_test.dart` all pass. The book export was not run locally, as instructed.
5. **Final report — written** at the end of session 3 (in the chat, not a file): what changed, what was verified, the Atlanta WebFetch-only caveat, the hidden-name decision, the admin dialog's required Author field, the production steps (`prisma migrate deploy` for `20261107000000_etiquette_author` then `npm run seed:etiquette`), and what stays unverified.
6. **Memory — done.** `project_prabhupada_name_hidden.md` and `MEMORY.md` updated to note the etiquette seed's `HIDDEN_NAME` rule and its use of speaker / scripture / temple names as `author`.

## Remaining work (all optional unless noted)

- [ ] **If asked:** branch and commit (below). Nothing else is required for the feature.
- [ ] Drive the admin **Devotee etiquette** page in a browser (add, edit, exclude, hand translation, start a run with a real key).
- [ ] Run `app/` on a phone: Home card, list, item, a test push to a device with `hariharibol://etiquette/<id>`.
- [ ] Native-speaker review of the translations and category labels.
- [ ] A website page for etiquette (none exists).
- [ ] An `etiquette` tap target in the admin push composer — would need `backend/utils/push-rich.js` and `admin/src/lib/push-link.ts` changed together and `test/push-rich.test.js` kept green. Deliberately not done; the app's push-link doc says so.
- [ ] Clean-HEAD run of the full app suite to settle the 10 failures.
- [ ] Drop the scratch database when finished: `dropdb hhb_etiquette_scratch` (it is a local side effect; it is not the dev DB).

## Production steps

1. `prisma migrate deploy` for `20261103000000_devotee_etiquette` **and `20261107000000_etiquette_author`** (it also applies any other pending migration; the first grants both permissions to `admin` and `super_admin` itself).
2. `npm run seed:etiquette` (or `npm run seed`). On an existing database this also fills in each row's author and refreshes the audited wording on rows nobody edited; an edited row keeps its edits and only gains the author if it had none.
3. Restart the API **and the worker** (the worker registers the 15-minute `etiquette.deliver` job at boot).
4. Set `etiquette.delivery.time` in the admin settings if 07:15 is not wanted (multiples of 15 minutes only).
5. In the admin panel, run a translation per language once a provider key is set.

## Working tree and "If asked to commit"

`git status --short` showed about 239 entries; most are unrelated earlier work (chat, local push, user location, own mantras, and so on). Shared files carry other features' hunks too: root/admin/app/backend `CLAUDE.md`, `schema.prisma`, `package.json`, the ARBs and generated l10n, `app_router.dart`, `app_routes.dart`, `api_paths.dart`, `push_config.dart`.

- Branch first (the current branch is `main`): `git switch -c feat/devotee-etiquette`.
- **Never `git add -A`.** Stage the etiquette paths by name and use `git add -p` for the shared files.
- Subject: `feat: devotee etiquette with daily push and translations` (56 characters, under the 70 limit).
- End the message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; end a PR description with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Do not push or open a PR unless asked. Nothing runs on `main`; the workflows run only for `production`.

## Gotchas

- Run Flutter only through `app/tool/flutter.sh` (pinned 3.44.2 / Dart 3.12.2).
- Never read, copy or commit anything from `hariharibol-local-secrets`, `.env`, Firebase configs or signing keys.
- Every app string goes in all 12 ARBs (`test/l10n_parity_test.dart`).
- Use absolute paths; zsh needs quoted glob flags; macOS `cat` has no `-A`.

## Suggested opening message for a new chat

> Read `/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/DEVOTEE_ETIQUETTE_PROGRESS.md` and finish "Unfinished from session 2", in order. Do not commit unless I ask.
