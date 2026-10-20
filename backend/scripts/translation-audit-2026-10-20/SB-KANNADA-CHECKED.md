# Śrīmad-Bhāgavatam → Kannada: what has been checked and fixed

Memory file for the next quality check. **If asked to check more Kannada Bhāgavatam cantos, skip everything in the
table below and check only cantos that are not listed.**

## Already checked AND fixed on S3 (2026-10-20)

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
- **Not done yet:** kn cantos 4–12 (the canto-4 run was still writing `c4-*` — 24 files — when cantos 1–3 were fixed; it has the
  same defects and the same tools apply, see the end). Hindi (cantos 1–6) was audited on 2026-10-17 (see the Hindi audit notes in memory).
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
Neither step has been done as part of this fix.

## Before running kn cantos 4–12 (and for canto 4 now)

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
