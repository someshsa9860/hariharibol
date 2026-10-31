# Narration (AI voices): progress

Handover for the next session. Last updated 2026-10-31.

## Where it stands

- The backend pieces are committed on `main` and not yet wired to an admin route or panel page.
- Nothing is applied to any database. Nothing has run against a live engine or the real S3 bucket.
- Unit tests pass: `test/narration.test.js` (36) and `test/narration-engines.test.js` (12).
  Run them one at a time from `backend/` (Node 20 works). Set `AWS_ACCESS_KEY_ID=` and `AWS_SECRET_ACCESS_KEY=` blank and point `SOURCE_LOCAL_DIR` at an empty folder.

## Done

- Schema: `NarrationRun` and `NarrationClip`. Migration `20261121000000_narration_runs` is not applied anywhere. It grants `narration.read` and `narration.run` to admin and super_admin.
- `config/narration.js`: engines (Google Chirp 3 HD, Gemini TTS), languages (en, hi), defaults and limits.
- `utils/narration.js`: keys, S3 layout, text hash, clip staleness, cost estimate, error classifier, presenters.
- `services/narration.js`: sources, clips, `_index.json`, reconcile, activity feed, start lock.
- `services/narration-engines.js`: Chirp and Gemini requests, PCM-to-WAV, `EngineError`.
- `jobs/processors/narration.js`: BullMQ processor for NARRATION and COMPARE runs. Handles pause, resume, cancel and heartbeat.
- Worker wiring: queue `narration` (attempts 1, concurrency 1), reconcile timer, failed handler, shutdown abort. Websocket events `narration.run`, `narration.activity`, `narration.clip`. Env `GOOGLE_TTS_API_KEY` and `NARRATION_GEMINI_TTS_MODEL`.

## Next, in order

1. Read `backend/config/translation.js`. Confirm it provides `retryBaseMs`, `retryMaxMs`, `maxAutoRetries`, `unknownRetries`, `unknownRetryMs`, `heartbeatMs`, `staleHeartbeatSeconds`, `feedLines` and `feedDays`. `config/narration.js` gets them by spreading it.
2. `backend/controllers/admin/narration.js` and `backend/routes/admin/narration.js`, modelled on `controllers/admin/scene.js` and `routes/admin/scene.js`. Register `narrationRoutes` in `routes/admin/index.js` in the same change.
   - Reads (`narration.read`): overview, estimate, runs, run/:id, compare/:id, clips, clip/:id (presigned URL), voices, languages.
   - Writes (`narration.run`): POST `/runs` (start lock `narration:start:<book>`, one live run per book, 409 otherwise), `/runs/:id/resume`, `/runs/:id/cancel`, POST `/compare`.
3. `npx prisma generate` (touches no database) so `prisma.narrationRun` exists at runtime.
4. `backend/scripts/narration-e2e.js`, modelled on `scripts/scenes-e2e.js`, with fake engines through the `synthesize` dep. Add `test:narration` to `package.json`.
   **Blocked:** the e2e needs the migration applied to the local dev database. Ask before applying it.
5. Admin panel: `admin/src/lib/narration.ts`, `admin/src/routes/narration.tsx` (Runs and Compare tabs), a nav entry gated by `narration.read` labelled "Narration (AI voices)".
6. Docs: a "Narration (admin)" section in `backend/CLAUDE.md` and a page section in `admin/CLAUDE.md`. The root `CLAUDE.md` status row is shared, so ask before changing it.

## Not verified

- Prices, model ids, Chirp's 5,000-byte limit and 200 rpm come from third-party summaries.
- Gemini TTS `maxBytes` (2000) and `rpm` (10) are guesses. No Gemini TTS price is known.
- ffmpeg is not installed. Do not install it on the server without asking.

## Decisions

- Narrated text is the translation, not the purport.
- Default book is the Gita.
- S3 layout: `narration/api/<book>/<language>/<engine>/<model>/<voice>/[canto-<n>/]ch-<n>/<verseNumber>.<ext>`, with `_index.json` in each voice folder.
- Chapter ids: canto × 100 + chapter for the Bhagavatam, chapter number for the Gita.
- One live run per book. A COMPARE run is queued, and its clips share the `NarrationClip` table.
- A target stops after 5 refusals in a row. Verses with no text are left out with a warning.
- No AiUsageLog rows and no minute meter. Overwrites are not backed up.
- The "ahead" ordering is run-wide, not per book.

## Constraints

- Do not edit `sakha-speech/` or the support files.
- The guru `Narration` model is separate from `NarrationRun` and `NarrationClip`.

## Production

- Run `prisma migrate deploy` for `20261121000000_narration_runs`, restart the API and the worker, and deploy the admin panel with the API.
- Set `GOOGLE_TTS_API_KEY` and `NARRATION_GEMINI_TTS_MODEL` only if those engines are used.
