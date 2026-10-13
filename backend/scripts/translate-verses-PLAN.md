# Plan: translate Gita + Bhagavatam verses into 13 languages (7 AI languages now, 4 later)

> **Alternative built 12 Oct 2026:** a Claude-based Gita pipeline exists (`translate-claude.js`,
> see `README.md`, "Translating the Gita with Claude"). It writes `json/bhagavat-gita/<lang>/ch-<n>.json` beside the English and does not touch this plan.

> **Status: planned on 11 Oct 2026, not started.** Nothing in this file is built: no script, no
> change to `services/ai/`, no AI call made, nothing uploaded to S3. This is the agreed design, kept
> here so the work can begin later; delete the file once `scripts/README.md` carries the finished
> "Translating verses" section.
>
> **Before starting, re-check what was true on 11 Oct 2026** (these move): the model names and prices
> (`gemini-3.8-flash` / `gemini-3.6-flash`, $0.75 in / $3.75 out per 1M, doubling on 1 Jan 2027),
> whether `gemini-2.5-flash` still exists, and how far `npm run fill:status` has got (the Bhagavatam
> must wait for the Prabhupada fill run). **Build order:** (1) `services/ai/` changes and the `--smoke`
> call; (2) `lib/translate-validate.js` with its tests; (3) languages, glossary, prompt, plan;
> (4) the CLI with `--dry-run`; (5) the pilot on Gita chapter 2, then the bake-off; (6) phase 1 on the
> whole Gita; (7) phase 2 (`--audit`). Do not upload anything before the pilot has been read by a
> native speaker. The conversation that produced this plan is not needed to follow it.

## Context

The English scripture JSON in the `sanatan-db` bucket (Prabhupada's translation and purport) is the only
text the app can show a reader in English. To serve the other languages the owner wants **a faithful
rendering of exactly that English text** in hi, mr, gu, bn, ta, te, kn, or, pa, ml, as. **For now the AI
languages are hi, mr, bn, ta, te, kn, ml; gu, pa, or, as wait** (see Decisions). Nothing new may
be written by the AI. Each verse is sent to Gemini with its context (Sanskrit, transliteration, Prabhupada's
English translation and purport, word-by-word). Gemini returns JSON for all requested languages. A
validator checks every answer, and only then do new chapter-wise files go to S3 in the same shape as the
English ones.

The archive already tried a version of this (`unorganized:backend/scripts/translate_gemini.py`): meaning
only, no purport, DB only, no S3, no validation. This replaces it. Reuse its lessons: 20-item JSON arrays
keep answers aligned, and honour Google's `retryDelay` on a 429.

### Decisions already made (from the owner)

| Question | Decision |
|---|---|
| Model | **Gemini `gemini-3.8-flash`** (newest Flash, GA 2 Sep 2026; Google's deprecations page, updated 9 Oct 2026, recommends it for new projects), through the existing `services/ai/` (logged to `AiUsageLog`, monthly budget guard applies). `gemini-2.5-flash` is not chosen: access is limited to projects that already used it, one source dates its shutdown 16 Oct 2026, and it is an older generation; it joins the pilot bake-off only if our key can call it. See "Model check" below. |
| Languages now | **AI: `hi, mr, bn, ta, te, kn, ml`** (7). Marathi is firm: the owner is from Maharashtra, and the app already carries Dnyaneshwari in Marathi. `en` is copied and `sa` is the original verse, so 9 files per chapter. **Held back for now: `gu, pa, or, as`**: Hindi serves most readers in those states, their audiences are the smallest, and Odia and Assamese will be the hardest for us to get a native reader for. They are added later by running `--langs gu,pa,or,as`, which needs no code or file-layout change: the language table keeps all 13, and a language's pairs and chapter files are independent of the others. |
| Hindi | AI like the others, from the same English text, so it matches our English exactly. bhagavadgita.com is ruled out: it credits Gita Press / Chinmaya / Ramsukhdas (not Prabhupada, and outside the approved list) and its terms are non-commercial. BBT's own Hindi is a scanned PDF of a different English edition. It may be used as a reference in the pilot, never published. |
| Content | Prabhupada **translation + purport**, plus **word-by-word meanings**, **chapter titles**, and the **Sanskrit verse in each language's own script** (deterministic, no AI). The owner's answer ticked "translation + purport only" together with the extras, so this plan reads that as the baseline; every extra gets a `--skip` flag in case that was misread. |
| `en` | Copied from the English JSON, Prabhupada only, no AI call |
| `sa` | The original Devanagari verse + transliteration + word-by-word. **No** AI-written Sanskrit prose. |
| S3 path | New root `json/translations/` — never touches the existing `json/bhagavat-gita/hi/` etc. |

## Files

All Node ESM, run from `backend/`. Follows `backend/scripts/README.md`: idempotent, resumable, nothing leaves the machine without `--upload`.

**New**
- `scripts/translate-verses.js` — the CLI (flags below).
- `scripts/lib/translate-languages.js` — the 13 languages (with a `DEFAULT_LANGS` of the 7 run now; `--langs all` runs all 11 AI ones): code, English name, endonym, Unicode block for the script check, `sanscript` scheme, sentence-final mark (danda vs full stop, as in `app/lib/l10n/README.md`), forbidden characters (Assamese: Bengali `র` U+09B0 never appears — it uses `ৰ`/`ৱ`).
- `scripts/lib/translate-glossary.js` — fixed terms: ~40 Sanskrit names and terms (Kṛṣṇa, Arjuna, Bhagavān, Viṣṇu, dharma, …) stored once in Devanagari with IAST/ASCII aliases, rendered per language by the same script converter, so no hand-typed table of 11 columns. Plus the honorific list ("Lord", "Supreme Personality of Godhead", "Śrīla Prabhupāda"). Reuses the UI terms already agreed in `app/lib/l10n/README.md` (purport, canto, chapter).
- `scripts/lib/translate-prompt.js` — `PROMPT_VERSION`, the system prompt and the per-call user prompt.
- `scripts/lib/translate-plan.js` — loads a chapter, builds units, splits purports into paragraph chunks, packs chunks into calls.
- `scripts/lib/translate-validate.js` — pure functions, no I/O (see Validation).
- `scripts/lib/translate-output.js` — builds the per-language chapter file; wraps the script converter.
- `test/translate-verses.test.js` — `npm test`, stub model, no network.

**Modified**
- `scripts/lib/source-upload.js` — add `createIfAbsent(key, body)`: `PutObject` with `IfNoneMatch: '*'` (SDK 3.1127 supports it). A re-run can never overwrite. `--replace` reuses the existing `replaceSafely` (backs up to `json-backup-<date>/` first).
- `services/ai/gemini.js` — return `finishReason` so a cut-off answer (`MAX_TOKENS`) is detected and split instead of half-parsed; count **thinking tokens** in the output total (they are billed as output, so `AiUsageLog` under-reports without them); an optional `thinkingLevel` (always sent: `low` for translation and audit, since an unset level runs on `medium`); no `temperature` on Gemini 3.x (Google's notes call it deprecated and say values below 1.0 can cause looping); add prices to `PRICING`: `gemini-3.8-flash` $0.75 in / $3.75 out per 1M until 31 Dec 2026, then $1.50 / $7.50, and `gemini-3.6-flash` the same.
- `services/ai/index.js` — pass `finishReason` and `thinkingLevel` through; `OPERATIONS.VERSE_TRANSLATE = 'verse.translate'` and `VERSE_TRANSLATE_AUDIT = 'verse.translate-audit'`; read `ai.model.translate` before `ai.model.text`, so this job's model does not change every other batch job.
- `config/env.js`, `.env.example` — the default `GEMINI_MODEL=gemini-2.0-flash` was **shut down on 1 Jun 2026** (replacement per Google: `gemini-3.6-flash`). Any batch job still on that default fails. Change the default to `gemini-3.8-flash`.
- `config/constants.js` — `AI_MODEL_TRANSLATE: 'ai.model.translate'` and `AI_MODEL_AUDIT: 'ai.model.audit'`.
- `package.json` — scripts `translate:verses`; dependency `@indic-transliteration/sanscript` (Devanagari → Bengali / Gujarati / Gurmukhi / Odia / Tamil / Telugu / Kannada / Malayalam).
- `scripts/README.md` — a "Translating verses" section.

## How a run works

1. **Load.** BG: Sanskrit + word-by-word from `json/bhagavat-gita/sa/ch-N.json`, translation + purport from `.../en/ch-N.json`. SB: everything from `json/srimad-bhagavatam/en/cX-ch-Y.json`. Read through `lib/source-s3.js` (`getJson`, `listKeys`). **Keep only `translatorSlug === 'prabhupada'`**: the BG `en` files also carry 701 Sivananda entries mislabelled `type: "purport"`, which would otherwise leak in.
2. **Unit = one verse entry** (compound entries such as `2.1.2.28-29` stay one unit). Items inside it: `translation`, `purport:1..n` (split on paragraph breaks; a paragraph over ~350 words is split at sentence ends), `wm:1..k` (word-by-word glosses in batches of ~40), `chapterTitle` (once per chapter).
3. **Pack calls.** Every call carries the full verse context (Sanskrit, transliteration, English translation, the whole purport as read-only reference) plus the items to translate. Estimated output (words × languages × tokens-per-word) is kept under a per-call budget; if one item is too big, the language list is split into groups. Default is **all the languages being run in one call** (7 now), as requested.
4. **Phase 1: translate and validate** (next section). Nothing from a model is accepted on the strength of the model's own answer: every returned (item, language) pair must pass the free validator before it is kept. The AI audit is a separate, later phase (`--audit`).
5. **Save** accepted pairs to the work dir after each verse (atomic write), so a kill or crash loses at most one verse.
6. **Assemble** one file per (book, chapter, language) once all its verses are fully accepted, then **upload** when `--upload` is given.

429/503 from Gemini: back off using the `retryDelay` in the error body, falling back to exponential. A `AI_BUDGET_EXHAUSTED` stops the run cleanly (it resumes after the budget is raised).

## Prompt rules (the "exactly like English, with respect" requirement)

- English text is the **only source of truth**. Sanskrit and transliteration are for understanding, never re-translated or substituted.
- Translate **sentence by sentence, same order, same sentence count**. No adding, dropping, explaining, summarising, softening, modernising, merging or "improving". No footnotes, notes or translator's remarks.
- Parentheses, brackets, quotations, verse references (e.g. "Bg. 7.14"), numbers and emphasis are kept as in the source.
- Proper names and Sanskrit terms are **transcribed into the target script, not translated** (Kṛṣṇa → कृष्ण / ಕೃಷ್ಣ …) using the glossary forms. Honorifics are rendered with the traditional respectful term of that language, never a flatter equivalent.
- Theological content is rendered exactly as stated, no neutralising and no adding comparisons or disclaimers.
- Sentence-final mark per language (danda vs full stop). Assamese uses `ৰ`/`ৱ`.
- Return JSON only, exactly the requested keys.

## Validation (`lib/translate-validate.js`)

**Errors (the pair is retried):**
- Not valid JSON, a missing/extra item id or language key, a non-string, or an empty value where the source is not empty.
- Script check: ≥ 90% of letters fall in the language's Unicode block. Latin letters beyond the glossary's allowed few (verse references, "Bg.") mean untranslated English.
- Forbidden characters for the language (Assamese `র`), markdown fences, "Note:", "Translator", "As an AI" and similar added meta-text.
- **Numbers**: every number in the English (after folding native digits to ASCII) is present in the output, and none extra.
- **Length**: word-count ratio to the English within a per-language band (catches truncation and runaway additions).
- **Structure**: parenthesis/bracket/quote counts equal to the source; paragraph count equal.

**Warnings (accepted, but listed in the report for a human):**
- A glossary name that is in the English but whose rendered stem is missing from the output.
- Sentence count off by more than ~15%.

## Two phases: translate first, audit after

A "pair" is one (item, language), e.g. (`purport:2`, `ta`). Both phases work on pairs, so one bad language never costs the good ones. Cost is secondary in phase 1: quality first.

### Phase 1 — translate, with the free validator (`node scripts/translate-verses.js`)

1. **Request 1 — translate.** Ask for every pair of the verse (`services/ai.complete`, operation `verse.translate`, JSON). Thinking is kept at the **lowest level the model allows**: `low` on `gemini-3.8-flash`. It cannot be switched off on 3.8, and a request that names no level runs on `medium`, so the level is always sent explicitly. Translation copies meaning sentence by sentence; the validator and the phase 2 audit catch what reasoning would have, and thinking tokens are billed as output and count against the 65k output cap. The smoke call confirms the exact request field. Response `{ "<itemId>": { "hi": "…", … } }`.
2. **Free validator** (above) on every pair, plus `finishReason` (a cut-off answer is a failure, never half-parsed). A pair that passes is **accepted** and saved to the work dir at once.
3. **Re-ask only the failed pairs**, with the validator's reasons in the prompt. Accepted pairs are never re-asked or thrown away. Round 1 asks all languages together, round 2 the failed ones together, round 3 and later one language per call.
4. **Round cap.** After round 4 (the first plus three fixes) a pair that is still failing goes to `needs-review` in the report and its language's chapter file is held back (a half-translated chapter is worse than none). The next run retries only those pairs. `AI_BUDGET_EXHAUSTED` stops the run cleanly.
5. **Assemble** the chapter files (`"audited": false` in `meta`), and upload them with `--upload`. This is safe before the audit: nothing reads `json/translations/` yet.

The validator is what stands between the model and S3 in this phase. The owner's note on this was cut off ("for first phase also we need to make sure atleast we have…"); this plan reads it as "at least the free checks", so they are strict: script, numbers, length band, brackets and paragraph counts, forbidden characters, no meta-text, no cut-off, and the glossary names. If something else was meant, change it here before building.

### Phase 2 — AI audit across all verses (`node scripts/translate-verses.js --audit`)

Runs only after phase 1 has finished for the chosen scope, over the saved results.

1. **Audit request.** One request per verse carries Prabhupada's English plus the saved text of every pair. It runs on a **different model** (`ai.model.audit`, default `gemini-3.6-flash`) so it does not share the translator's blind spots. For each pair it back-translates literally to English, compares with the source, and returns `{ ok: bool, issues: [{ kind: added | missing | changed | disrespectful | untranslated | wrong-name, quote, why }] }`. It only judges; it never rewrites. Style or word-choice differences that keep the meaning are not issues.
2. **Fix.** Pairs with `ok: true` stay. Pairs with issues are re-translated alone (translator model, the auditor's quoted issues in the prompt), then validated and audited again, with the same round cap.
3. **Re-upload** the changed chapter files with `--replace` (backs up to `json-backup-<date>/` first) and `"audited": true` plus `auditModel` in `meta`.

"Perfect" means *passed the validator and an independent model's literal back-translation comparison*. It does not mean a native devotee has read it; that review stays a release step and the report lists what to read first (anything that needed more than one round, plus all warnings).

Cost for the Gita, see "Open items": with the 7 languages run now, phase 1 is about $37 and phase 2 (audit plus fixes) about $22 (about $55 and $35 for all 11). `--audit-sample N` exists only for cheap experiments; a release audit covers every pair.

## Output

Keys (one file per language run × the same chapter units as English):
- `json/translations/bhagavat-gita/<lang>/ch-<n>.json`
- `json/translations/srimad-bhagavatam/<lang>/c<canto>-ch-<n>.json`

Shape: the English chapter file's shape, so `lib/commentaries.js` `buildTranslationRows` can read it unchanged later.

```json
{
  "meta": { "...the English meta...": "", "language": "hi", "sourceLanguage": "en",
            "translatorSlug": "prabhupada", "aiTranslated": true, "model": "…",
            "promptVersion": "1", "glossaryVersion": "1", "generatedAt": "…",
            "audited": false, "auditModel": null,
            "chapterTitle": "<translated>", "script": "devanagari" },
  "verses": [{
    "verseId": "1.2.47", "bookNumber": 1, "cantoNumber": null, "chapterNumber": 2,
    "verseNumber": 47, "verseNumberEnd": null,
    "sanskrit": "<original Devanagari>", "sanskritScript": "<same verse in this language's script>",
    "transliteration": "<unchanged>",
    "wordMeanings": [{ "word": "<unchanged>", "meaning": "<translated>" }],
    "commentaries": [
      { "translatorSlug": "prabhupada", "type": "translation", "language": "hi", "displayOrder": 1, "text": "…" },
      { "translatorSlug": "prabhupada", "type": "purport",     "language": "hi", "displayOrder": 2, "text": "…" } ]
  }]
}
```

`en` carries the same shape with Prabhupada's text untouched; `sa` has `sanskrit`, `transliteration`, `wordMeanings`, and no commentaries.

**Script conversion** uses only the Devanagari `sanskrit` field. SB cantos 1–9 transliteration is plain ASCII without long vowels, too lossy to convert, so a verse with no Devanagari is skipped and listed. Assamese is Bengali script with `র→ৰ`. Tamil script cannot hold every Sanskrit sound, so use `sanscript`'s Tamil scheme and flag it for a native reader.

## CLI

```
node scripts/translate-verses.js [--only bg,bg:2,sb,sb:1,sb:1:2] [--langs hi,ta,…|all] [--pilot N]
                                 [--dry-run] [--workers 3] [--upload] [--replace] [--redo]
                                 [--skip wordmeanings,titles,script] [--max-rounds 4] [--audit [--audit-sample N]]
                                 [--max-spend <usd>] [--work <dir>] [--status] [--smoke]
```

- `--dry-run` counts source words per book and prints an estimated token count and cost for the resolved model; calls nothing.
- `--pilot N` does the first N verses of each selected chapter and writes no chapter files.
- `--status` prints progress, failed pairs and warnings from the work dir.
- Work dir `backend/.translate-work/` (gitignored): `results/<unit>.json` per verse, `report/`, `state.json`, `translate.log`.
- Refuses to run with `SOURCE_LOCAL_DIR` set **and** `--upload` together (same guard as `fill-prabhupada-source.js`). `SOURCE_LOCAL_DIR=.fill-work/source` is fine for pilots.
- Needs both `backend/.env` (Gemini key, DB for `AiUsageLog`) and `backend/.env.scripts` (`SOURCE_*` bucket credentials, which must be allowed to write for `--upload`).

## Verification

0. **Smoke call first** (`--smoke`, one tiny request, prints the raw response): confirms on the real API what Google's docs did not settle for `generateContent` — that `gemini-3.8-flash` accepts our JSON mode, which field sets the thinking level, where thinking tokens show up in `usageMetadata`, and what `temperature` does. Nothing else is built on a guess about these.
1. `npm test` — stub translator and stub auditor. Phase 1: all pairs pass first time (1 request); one language fails the validator, is re-asked alone and the good ones are kept untouched; a pair that never passes stops at the round cap, lands in `needs-review` and holds back that language's file; an accepted pair is never sent again. Phase 2 (`--audit`): the auditor flags one language, only it is re-translated, validated and audited again; audited pairs are not audited twice; `meta.audited` flips only when every pair in the file passed. Also: packing stays under budget, a killed run resumes without redoing finished verses, validator accepts a good Hindi sample and rejects each error kind (English left in, a dropped number, a truncated answer, Assamese `র`, "Note:"), `createIfAbsent` never overwrites.
2. `--dry-run --only bg` — word counts and a cost estimate. Check them against `fill:status`-style numbers (BG ≈ 205k purport words + 25k translation words).
3. Pilot: `--only bg:2 --pilot 5` with `SOURCE_LOCAL_DIR=.fill-work/source`. Read the results for 2–3 languages. Record **real tokens per word** from `AiUsageLog` and re-run the estimate with it. **Bake-off:** run the same 5 verses on `gemini-3.8-flash` and `gemini-3.6-flash` (plus `gemini-2.5-flash` if our key is allowed to call it, and `gemini-3.5-flash-lite` as the cheap floor), each at thinking `low` (`gemini-3.6-flash` also at `minimal`, and `gemini-3.8-flash` once at `high` only to check that thinking is not worth its cost); compare validator failures, audit failures and a native reader's pick. The model is only changed if another one clearly wins here. No published benchmark measures Indic translation for these text models, so the bake-off is the evidence, not the model's name. For Hindi, also compare against BBT's printed Hindi for the same verses (reference only).
4. Phase 1 on the full Gita without `--upload`; read `report/` (failed pairs, warnings); have a native speaker of at least Hindi, Tamil and Bengali read a sample against the English.
5. `--only bg --upload`; confirm with `listKeys('json/translations/bhagavat-gita/')` (18 files × 9: 7 AI languages + `en` + `sa`) and a size check per object. A second run uploads nothing.
5b. Phase 2: `--only bg --audit` over the saved results; read what the auditor flagged and what the fixes changed, then re-upload with `--replace`.
6. Bhagavatam only after `npm run fill:status` shows the Prabhupada fill finished (at the last snapshot it was 19 of 335 chapters, and it is still rewriting SB `en` objects). Start with one canto.

## Open items for the owner (not built in this change)

- **Attribution.** These are an AI's renderings of Prabhupada's words, not his. The files say so (`aiTranslated`, `model`, `promptVersion`), but how the app labels them is a decision. Importing under translator slug `prabhupada` would blur that. Importers (`import-bg.js`, `import-sb.js`) do not read `json/translations/` yet; that is the next change.
- **Native-speaker review.** The validator catches structure, numbers, script and length. It cannot judge reverence or accuracy of meaning. Treat the first release as unreviewed until native readers have signed off, as `app/lib/l10n/README.md` already does for the UI strings.
- **Model check (done twice, 11 Oct 2026).** Pass 1, Google's models, pricing and deprecations pages: newest Flash is `gemini-3.8-flash` (stable, 2 Sep 2026; 1,048,576 in / 65,536 out; JSON output, thinking low/medium/high, Batch API). Pass 2, the release notes, the model's own page and an outside search: they agree on the model, its date and `gemini-3.7-flash` being routed to it. **Not confirmed anywhere:** an Indic translation benchmark for these text models (the aggregator lists multilingual as "not measured"; the only Hindi/Tamil results found were for the TTS models), and the exact `generateContent` field names for thinking level. Both are settled by the smoke call and the bake-off above, not assumed. **`gemini-2.5-flash`** (checked 11 Oct 2026): Google's deprecations page (last updated 9 Oct 2026) says it is "not deprecated", has "no shutdown date announced", but access is limited to users who have actively used it, and new projects should use 3.5 Flash-Lite or 3.8 Flash. A July forum post quoted 16 Oct 2026 as its shutdown date on that page, and Firebase's docs say the 2.5 models shut down in October 2026 on the Agent Platform API, so the date is contested. Price $0.30 in / $2.50 out.
- **Price window.** `gemini-3.8-flash` is $0.75 in / $3.75 out per 1M tokens **through 31 Dec 2026**, then $1.50 / $7.50. Batch is half. So the Bhagavatam is cheaper to finish before the end of the year. `services/ai` has no batch mode, which would halve the cost again but turns a run into an overnight job.
- **Cost for the Gita (measured words, assumed tokens).** Counted from the local source, Prabhupada only: 701 verse entries; 25,267 translation words + 204,574 purport words + 19,465 word-by-word meaning words + 18 chapter titles = **249,406 English words** to render into 11 languages. Assumptions: English ≈ 1.4 tokens/word; Indic output ≈ **4.0 tokens per English word per language** (3.0 to 5.5 across the 11 languages, to be measured in the pilot); ~1,000 thinking tokens per request; a call's output is kept under 30k tokens so the biggest verses split (max 5 calls for one verse); 10% of pairs need a second try. Price $0.75 in / $3.75 out per 1M, both models.

  | Step | Requests | Input tokens | Output tokens | Cost |
  |---|---|---|---|---|
  | Translate (`gemini-3.8-flash`) | 792 | 3.9M | 12.3M | $49 |
  | Check (`gemini-3.6-flash`, back-translation + verdicts) | 792 | 13.6M | 5.0M | $29 |
  | Fix rounds (defective pairs only, translated and re-checked) | ~390 | ~2.7M | ~2.7M | ~$12 |
  | **Total** | **~1,970** | **~20M** | **~20M** | **~$90** |

  Range for the Gita: **$70–$135** (3.0–5.5 tokens/word × 5–20% of pairs failing the first time). Thinking at ~5k tokens per request instead of ~1k adds about $30. After 31 Dec 2026 the price doubles (~$180). The Batch API would halve it but `services/ai` has no batch mode. The Bhagavatam is roughly 15x the Gita's text, so about $1,300 on the same assumptions. Set `ai.budget.monthly_micros` for the run and use `--max-spend`.

  **With 7 languages instead of 11 (the plan now).** Dropping gu, pa, or, as removes about 35% of the output tokens (4 of 11 languages, and they are not the heaviest). Gita: phase 1 about **$37**, phase 2 about **$22**, so **~$60 in total** (range ~$45–$85) instead of ~$90. The Bhagavatam, roughly 15x, about $900. The four held-back languages cost about the other third whenever they are run. The table above and the by-phase figures below are for all 11 languages.

  **By phase (Gita, all 11 languages).** The table above is both phases together. Phase 1 alone (translate at thinking `low`, validator-driven re-asks) is about **$55**: $49 translating, about $5 for re-asks (assuming 5% of pairs fail the free validator); range $40–$70 for 3.0–5.5 tokens/word. Thinking at `high` would add about $15 (~5k more tokens on each of 792 requests). Phase 2 (audit $29 plus fixes, about $6) is about **$35**. On `gemini-2.5-flash` the translating alone would be about $32 instead of $49.
- **Not in this change:** Dnyaneshwari / other commentators, and importing the new files into the database.
