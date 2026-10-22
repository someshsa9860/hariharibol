# Śrīmad-Bhāgavatam → Kannada: what has been checked and fixed

Memory file for the next quality check. **If asked to check more Kannada Bhāgavatam cantos, skip everything in the
tables below. Cantos 1–12 are all done; there is nothing left to check unless a canto is re-translated.**

## Cantos 4–12: checked AND fixed on S3 (2026-10-22, in-session, no AI API)

| Language | Canto | Chapters (files) | Verses | Bytes after |
|---|---|---|---|---|
| `kn` | 4 | 31 | 1,387 | 13,389,914 |
| `kn` | 5 | 26 | 650 | 6,833,197 |
| `kn` | 6 | 19 | 760 | 6,478,196 |
| `kn` | 7 | 15 | 676 | 6,598,143 |
| `kn` | 8 | 24 | 848 | 6,320,047 |
| `kn` | 9 | 24 | 846 | 5,894,216 |
| `kn` | 10 | 90 | 3,572 | 26,591,501 |
| `kn` | 11 | 31 | 1,244 | 11,887,539 |
| `kn` | 12 | 13 | 480 | 3,161,599 |

- **273 files, 10,463 verses, 87,154,352 bytes**, written to `s3://sanatan-db/json/srimad-bhagavatam/kn/c<canto>-ch-<n>.json`
  canto by canto on 2026-10-22 (each upload read back and compared). **Backup of the files as audited:**
  `s3://sanatan-db/json-backup-2026-10-22/json/srimad-bhagavatam/kn/`.
- **No Anthropic / OpenAI / Gemini API was called** (the user's rule). The new Kannada was written in the session by Claude
  (Sonnet subagents and by hand); the audit and repair scripts only read files and S3. Everything of the job is in
  `backend/.translate-work/sb-kn-c4-12/` (gitignored): `orig/` (as downloaded), `work/` (as uploaded), `patches/`,
  `manual-patches.json`, the audits `audit-*.json`, the per-canto `kn-fix-patches-c<N>.json` / `kn-fix-report-c<N>*.json`,
  `RESUME.md`. The scripts there (`make-canto.mjs`, `check-patches.mjs`, `audit.mjs`, `show.mjs`, `fix-wm-lists.mjs`) are the tools used.
- **What was done:** 129 verses had a wholly wrong-language part (translation / purport / transliteration / word meanings) and were
  rewritten in Kannada from the English (28 batches, 129/129 validated); then 432 hand patches (an English word left
  in the Kannada, a Sanskrit quote or name in Roman letters turned into Kannada letters, Chinese / Korean / Cyrillic / Tamil /
  Malayalam / Sinhala / Gujarati letters that slipped into a word, an unclosed bracket) written by Sonnet agents against the exact
  text and checked by `check-patches.mjs`; then `tools/kn-fix.js` (Devanagari and other-script transliteration → Kannada letters,
  short e/o → long, verse number tails, junk word-meaning entries). 41 of the 432 patches are single transliteration letters (`manual-patches.json`);
  10 word lists whose length differed from the English were mended by `fix-wm-lists.mjs`. The final `kn-fix` dry
  run reported 0 changes for every canto, and `audit.mjs` shows no foreign script, no Roman run, no leaked `correctness` in the
  fixed files except the items under "Left as it is" below.
- **Rewritten parts are stamped** provider `anthropic`, model `claude-sonnet-5-5`, effort `in-session`, version `1.0-12-10-26`,
  with a note that they were written in-session with no API call. Small patches leave the original stamp.
- **Re-check cantos 4–12 only if** the file count / size above no longer matches, a file was modified after the upload on
  2026-10-22, or the user says they were re-translated. A re-translation would bring the defects back.

### Left as it is (4–12), for the next person to decide or to ask a native speaker

- **Dandas** (`।`) left in some purports: 2.7.15.26, 2.8.3.16, 2.9.4.26, 2.9.8.21, 2.10.2.27, 2.10.4.29, 2.10.10.17, 2.10.10.25,
  2.10.13.60, 2.10.78.16, 2.11.12.9, 2.11.15.16, 2.11.21.4. Many canto-11 transliterations end in ॥ — that is the verse-end mark.
  The (aa)–(ff) list markers in 2.7.5.23-24 stay Roman on purpose.
- **Patches the agent was not sure of (`sure: false`)** — spelling of Sanskrit quotes that could not be checked against the printed
  verse: p01 n4 (and 2.7.5.16 / the word meaning in the same verse, "argumentum ad baculum"), p02 n49 / n58 / n85, p07 n218
  (2.10.46.1), p12 n386 / n387 / n393 / n394 (`purports` → ಭಾಷ್ಯಗಳು), p06's 26 (Rādhā-kuṇḍa and foot-mark quotes spelled letter by
  letter), p09 n275 / n277 / n281 / n294, p10 n314 (a Śrīdhara quote, sandhi joins unknown), n326 (Bhāg. 4.29.79: source hyphens
  kept, so `ತದ್-ಆತ್ಮಕಂ` reads awkwardly), n343 (Brahma-saṁhitā 5.40), p11 n370 (2.11.14.26, a Bengali song line).
- **Quotes restored from Roman letters only** (not checked against the Devanagari verse): 2.6.1.16, 2.6.5.30, 2.7.6.17-18, 2.8.24.48,
  2.9.2.17. Word lists the translator rated 2: 2.6.18.78, 2.8.7.7, 2.9.14.38. Also worth a second look: 2.9.24.59, 2.10.6.22-23,
  2.10.16.30, 2.10.23.9, 2.10.27.11, 2.10.33.34, 2.10.42.28-31, 2.10.82.11, 2.10.85.20, 2.11.7.47 (ಪಿಎಚ್.ಡಿ.), 2.10.90.24 (ನೀನು for
  the swan), 2.11.2.23 (cāraṇa → ದೇವದೂತರು).
- **Sanskrit-quote joining differs a little between batches** (some leave a space, "ಮಾಮ್ ಅಜಮ್ ಅವ್ಯಯಮ್"; the later ones join as the
  Devanagari does, "ಕಾಮಾನ್ಯಃ ಸರ್ವಾನ್ಪುಮಾಂಶ್ಚರತಿ"). Roman-letter quotes of cantos 1–3 still stand as before.
- **Judgement calls:** 2.10.49.28 ಪಾಪಮ್ vs printed ಪಾಪಂ; 2.10.45.35-36 "(so)" → "(60)"; 2.10.60.37 "some" / "supreme" → ಕೆಲವು / ಸರ್ವೋಚ್ಚ;
  2.5.22.11 mended as a hyphenated `ಸಹಾಭಿಜಿತಾಷ್ಟಾ-ವಿಂಶತಿಃ`; 2.6.2.45 as `ವಿಪ್ಲಾವಿತ`; ಪ್ರಹ್ಲಾದೋ → ಪ್ರಹ್ರಾದೋ in the
  transliteration of 2.7.13.12-13 follows the Devanagari source; item 373 of p11 has ISKCON → ಇಸ್ಕಾನ್ followed by a ZWNJ and ನಲ್ಲಿ.
- **Probably an earlier mistranslation, not swept:** 37 other chapter-end lines say ಪುರಾಣಗಳು ("Purāṇas") where the English says
  "purports". Transliteration lines that differ from the source by 64–131 letters were flagged by the audit and may belong to the
  wrong verse; two `wholeRoman` texts in `patch-items/index.json` are not itemised and should be looked at.
- **Open glossary choices** (style, not errors; the same as for cantos 1–3): ಅತೀಂದ್ರಿಯ / ಅಲೌಕಿಕ, ನಿಮ್ಮ / ನಿನ್ನ for the Lord,
  ಸುಳ್ಳು / ಮಿಥ್ಯಾ ಅಹಂಕಾರ, ಅಸುರ / ರಾಕ್ಷಸ, ದ್ವಾರಕೆ, ಜಪಿಸುವುದು / ಕೀರ್ತನೆ. The patches follow `TASK.md`'s glossary (ಅತೀಂದ್ರಿಯ,
  ಸುಳ್ಳು ಅಹಂಕಾರ, ಭಗವದ್ಗೀತೆ, ಶ್ರೀಮದ್ಭಾಗವತ, ಪರಮ ಪುರುಷೋತ್ತಮ ಭಗವಂತ).
- **No native Kannada speaker has read any of it**, before or after. The mechanical defects are gone; nothing here says the Kannada is good.
- **Reaching the app is the same two steps as for cantos 1–3** (below) and **neither has been done** for cantos 4–12 either.

## Cantos 1–3: checked AND fixed on S3 (2026-10-20)

| Language | Canto | Chapters | Verses | Files (S3) |
|---|---|---|---|---|
| `kn` | 1 | 19 | 779 | `c1-ch-1.json` … `c1-ch-19.json` |
| `kn` | 2 | 10 | 370 | `c2-ch-1.json` … `c2-ch-10.json` |
| `kn` | 3 | 33 | 1,388 | `c3-ch-1.json` … `c3-ch-33.json` |

- Location: `s3://sanatan-db/json/srimad-bhagavatam/kn/c<canto>-ch-<n>.json`; 62 files, 2,537 verses.
- Produced by: openai / gpt-6-luna, effort off, promptVersion 7, version `1.0-12-10-26`. The repaired parts keep that stamp
  and `translatedBy: "gpt"`; a part the repair touched also carries `scriptFix: <time>` (and `redo` for the 27 verses the model redid).
- **State after the fix:** 62 files, **25,230,995 bytes**, last modified 2026-10-20 10:16:10 → 10:19:15 UTC. Every file was
  downloaded again after the upload and is byte-identical to the repaired copy.
- **Backup of the files as audited:** `s3://sanatan-db/json-backup-2026-10-20/json/srimad-bhagavatam/kn/c<canto>-ch-<n>.json`
  (62 files; before this fix they were 27,043,148 bytes, last modified up to 2026-10-20 03:06). Nothing under `c4-*` was touched.
- **Re-check cantos 1–3 only if** the file count / size above no longer matches, a file was modified after 10:19 UTC on
  2026-10-20, or the user says they were re-translated or redone. A re-translation would bring the defects back.
- Verse ids are `2.<canto>.<chapter>.<verse>` (the leading `2` is the book number).
- Cantos 4–12 were done on 2026-10-22 (section above). Hindi (cantos 1–6) was audited on 2026-10-17 (see the Hindi audit notes in memory).
- **Not seen by a native Kannada speaker** — before and after. Nothing here says the Kannada is good, only that the mechanical
  defects below are gone.

## What the audit found, and what the fix did

Meaning was good from the start (translation, purport and word meanings faithful and fluent; nothing missing). The weak part
was the Sanskrit lines and a few wrong-language parts. The fix ran in this order: model redo of the wholly wrong parts, then
the script (`tools/kn-fix.js`), then hand patches, then a stale-note scrub.

| Defect | Before | After |
|---|---|---|
| Parts written in another language (translation 23, purport 16, word-meaning entries 188, transliteration 230) | 26 verses | **0** — 27 verses / 58 parts redone by the model (`tools/kn-redo.js`, gpt-6-luna, effort off, ≈ $0.012) |
| Transliteration in Devanagari / Telugu / Malayalam / Tamil / Gujarati / Bengali / Sinhala letters, stray avagraha `ऽ` | 230 verses wrong-script, 435 mixed | **Kannada in all 2,537 verses**; letters moved to the Kannada block by offset |
| Verse number glued to the end of a transliteration | 174 verses | **0** (stripped) |
| Short e / o in the Sanskrit lines | many | long (`ಏ`/`ಓ` forms) |
| Letter slips against the Devanagari `sanskrit` of the English file (isolated, one letter) | 22,987 edits | **3,507** (exact match 560 → 1,216 verses) — only slips the source settles unambiguously were mended |
| Leaked `correctness` token (2.1.9.39, 2.2.9.5) | 2 | 0 |
| Blank lines between every paragraph (2.2.10.46, 2.2.5.17 and others) | several | 0 |
| Foreign words in Kannada text (Chinese `所谓`/`典`, Russian, Tamil, Telugu, Malayalam, Hindi words) | 7+ verses | 0 — 39 hand patches in `tools/kn-fix-patches.json` |
| Truncated purport 2.2.10.10 | 1 | redone by the model |
| Word-meaning list one entry too long (junk entry such as the last word repeated or Latin letters) | 5 verses | dropped: 2.1.3.19, 2.2.5.40-41, 2.3.15.48, 2.3.21.36, 2.3.29.1-2 |
| Model notes that complained about a wrong script that is no longer there | 41 verses | removed from `aiTranslation.note` and `parts[*].note` |
| Pipeline score 1 (any part) | 927 verses | 191 (re-scored by the pipeline's own validator) |

Changed: 1,448 verses in content (translation 30, purport 85, word meanings 289, transliteration 1,414) plus 41 note-only.

**Kannada text written by hand (by Claude, not the model)** — 39 patches in `tools/kn-fix-patches.json`, each with a `why`:
foreign-script words replaced by their Kannada (24 purport, 7 translation, 3 word-meaning entries), three meaning slips
(2.2.2.30 "point of neutralization", 2.2.9.17 "six opulences", 2.3.4.27 "fame" for ಯಶಸ್ಸು), "so-called" → ತಥಾಕಥಿತ (2.1.1.22, 2.1.12.25),
"Ṛṣಭ" → ಋಷಭ (2.1.3.9), "transcendental" → ಅತೀಂದ್ರಿಯ… in 2.3.4.28, 2.3.13.28, 2.2.1.8, and 5 transliteration spots. Those parts
still say `translatedBy: "gpt"`.

## Left alone on purpose

- **Style, not errors — needs a decision:** "transcendental" is ಅತೀಂದ್ರಿಯ 1,142 / ಅಲೌಕಿಕ 988 / ದಿವ್ಯ 170; addressing the Lord is
  ನಿಮ್ಮ 467 vs ನಿನ್ನ 127; "false ego" ಸುಳ್ಳು ಅಹಂಕಾರ 48 vs ಮಿಥ್ಯಾ ಅಹಂಕಾರ 22. Pick one of each (a glossary line in the prompt) before
  cantos 4–12 finish; do not mass-rewrite cantos 1–3 without the user choosing.
- Roman-letter Sanskrit quotes inside Kannada purports (e.g. 2.3.8.26, 2.3.29.15), abbreviations and references (a.m., p.m., SB 1.16.34,
  (a)–(e)) — about 16 purports and 1 word meaning still contain Latin letters; they are quotations, not mistakes.
- The remaining letter slips (≈ 2,200 spots where the source does not settle which letter: "not isolated", ā at a word end, consonant
  insert/delete, sandhi, more than 8 differences) and **2.3.33.37 / 2.3.13.12**, whose English `sanskrit` field is itself wrong
  (2.3.33.37 holds the next verse too; 2.3.13.12 holds verse 11's text) — the Kannada matches the English transliteration.
- The pipeline's own scores of 1, the 411 short word meanings (Kannada is shorter: `the Personality of Godhead` → `ಭಗವಂತ`), 2.3.12.47's
  real extra word entry, punctuation-count mismatches the validator still reports (parentheses / quotation marks, ≈ 200), 2 Bengali-song notes.

## How the fix reaches the app

S3 is the source of truth; phones read the database and the offline book export, so **S3 alone changes nothing on a phone**.
1. Admin → **Translations** → Import for `kn` (a dry run first). It replaces the existing `VerseTranslation` rows in place;
   rows that are new are **hidden unless publish is chosen, which needs `verse.publish`**.
2. Run `node scripts/export-book-cache.js` **on the server** (the dev `.env` points at the real bucket) — or let the minute-by-minute
   `book.cache.sync` do it — so phones fetch the changed units.
3. The app reads an imported `transliteration` (the reader's script) but **not yet `wordMeanings`**; the fixed word meanings
   show on the web/API only where they are sent.
Neither step has been done as part of this fix (cantos 1–3, nor 4–12).

## If a canto has to be fixed again (the way cantos 4–12 were done, and the way cantos 1–3 were)

Cantos 4–12 were done **without the model**: write the new Kannada in the session, patch against the exact text
(`backend/.translate-work/sb-kn-c4-12/PATCH-TASK.md`, `check-patches.mjs`), then `kn-fix.js` and `kn-upload.js`. Do it **one canto at a
time** (`make-canto.mjs <N>`), so something is on S3 even if the session ends. After every `kn-fix.js --write`, run it again as a
dry run and repeat `--write` until it reports `0` verses changed (a verse whose source transliteration is Devanagari only matches
a Kannada-letter patch on a second pass). Cut a patch's `find` from the stored text by program, never by hand — look-alike
letters of other scripts sit inside the Kannada.

Tools are in `tools/` here (none committed yet). All take a folder laid out like the bucket (`json/srimad-bhagavatam/kn/…`, plus `en/`):

```
# 1. download the cantos to be fixed (and their en/ files) into a NEW folder — never work in the bucket
# 2. redo whole wrong-language parts with the model first (list: { "redo": [{ "lang":"kn", "verseId":"2.4.1.1", "parts":["translation"] }] })
node tools/kn-redo.js propose --list redo.json --out proposal.json --local-store DIR
node tools/kn-redo.js apply   --proposal proposal.json --local-store DIR
# 3. the script repair (dry run without --write); add new hand patches to tools/kn-fix-patches.json
node tools/kn-fix.js --store DIR --patches tools/kn-fix-patches.json --report report.json [--write]
# 4. look at report.json, then put it on S3 with backup + ETag check + read-back (check mode first)
node tools/kn-upload.js --before ORIGINALS --after DIR --cantos 4 --expect <files> [--write]
```

- **Better to prevent it:** send the source `sanskrit` to the transliteration step and convert it by offset instead of rebuilding it
  from ASCII; add `ऽ→ಽ`; strip verse markers; add a post-run check for foreign scripts and for `correctness`; settle the glossary above.
- **`mergeEntry` quirk:** a redone translation/purport is appended with `displayOrder` 3 and lands after the purport (it happened in 6
  verses). After a redo, put the commentaries back in order (translation = 1, purport = 2) before the upload.
- **Never run `scripts/fix-translation-script.js` on the Bhagavatam** — it rebuilds the Sanskrit from the English ASCII transliteration,
  which has lost ś / ṛ / ā.
- Do not touch a canto while the translation job is still writing it.
