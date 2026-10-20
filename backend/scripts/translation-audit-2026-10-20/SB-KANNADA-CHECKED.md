# Śrīmad-Bhāgavatam → Kannada: what has been checked

Memory file for the next quality check. **If asked to check more Kannada Bhāgavatam cantos,
skip everything in the table below and check only cantos that are not listed.**

## Already checked (read-only audit, 2026-10-20)

| Language | Canto | Chapters | Verses | Files (S3) | Last modified on S3 |
|---|---|---|---|---|---|
| `kn` | 1 | 19 | 779 | `c1-ch-1.json` … `c1-ch-19.json` | 2026-10-19 19:55 → |
| `kn` | 2 | 10 | 370 | `c2-ch-1.json` … `c2-ch-10.json` | |
| `kn` | 3 | 33 | 1,388 | `c3-ch-1.json` … `c3-ch-33.json` | → 2026-10-20 03:06 (last file) |

- Location: `s3://sanatan-db/json/srimad-bhagavatam/kn/c<canto>-ch-<n>.json`; 62 files, 27,043,148 bytes, 2,537 verses.
- Produced by: openai / gpt-6-luna, effort off, promptVersion 7, version `1.0-12-10-26`.
- Verse ids are `2.<canto>.<chapter>.<verse>` (the leading `2` is the book number).
- **Re-check cantos 1–3 only if** the S3 files changed after 2026-10-20 03:06 (`aws s3 ls`), the count is no longer
  62 / 27,043,148 bytes, or the user says they were re-translated or redone.
- Nothing was written to S3, the database or the code by this audit.
- Not checked yet: kn cantos 4–12. Hindi (cantos 1–6) was audited on 2026-10-17 (see the Hindi audit notes in memory).

## Result in one paragraph

**Good for meaning, weak in the Sanskrit lines.** Translation, purport and word meanings read faithfully and fluently;
nothing is missing and nothing is truncated except one purport. 927 of 2,537 verses (36.5%) carry at least one part the
pipeline itself rated 1, and the fixable defects below are almost all among those. No native-speaker review was done.

## Numbers

- Complete: all 2,537 verses have translation, transliteration, word meanings; purport wherever the English has one.
- Stored self-scores (1 / 2 / 3): translation 29 / 1,291 / 1,217; transliteration 872 / 1,663 / 2; word meanings 291 / 2,171 / 75;
  purport 99 / 1,476 / 641. Canto 1: 287 of 779 verses have a score-1 part; canto 2: 149 of 370; canto 3: 491 of 1,388.
- Length against the English: translation median 0.90, purport median 0.89 (characters). No runaway or repeated text.
- Word meanings: same number of entries as the English in 2,531 of 2,537 verses (6 have one extra); 99.9% of headwords correspond.
  The 411 "short" meanings are false alarms — Kannada is simply shorter (`the Personality of Godhead` → `ಭಗವಂತ`).
- Zero unassigned code points anywhere.

## Defects to fix (verse ids)

1. **Transliteration written in Devanagari instead of Kannada: 219 verses** (listed in `a1.json` in the session scratchpad
   only; regenerate with the script check — any verse whose `transliteration` has mostly U+0900–097F). Plus 10 Telugu and 1 Malayalam.
   Mechanical fix: convert by Unicode offset (Devanagari → Kannada, +0x380); no model needed.
2. **Stray other-script letters inside Kannada transliteration**: avagraha `ऽ` ×403 in 369 verses (should be `ಽ`),
   Gujarati letters in 37 verses, Telugu 13, Malayalam 9, Tamil 9, Bengali 5.
3. **Wrong-language parts: 26 verses** (translation or purport written in another language/script). All are already stored as score 1.
4. **Truncated purport: 2.2.10.10** — 2,151 chars against 5,677 in English, stops at the start of a Gita quotation.
5. **Output-format leak: 2.1.9.39 and 2.2.9.5** — purports end with `correctness` / `],` (the model's own field name).
6. **Stray foreign words inside Kannada text (7 verses)**: Chinese `所谓` ("so-called") in the purports of
   2.1.12.27, 2.2.3.18, 2.2.8.3, 2.3.6.31; `典` in 2.1.13.23; Russian `наслед…` in the translation of 2.1.17.31;
   Cyrillic `га` in 2.2.9.5.
7. **Paragraph structure**: 2.2.10.46 has blank lines between every paragraph (75 vs 38); 2.2.5.17 likewise.
8. **Transliteration slips against the Devanagari source** (consonant skeleton compared to the English file's `sanskrit` field,
   2,307 Kannada-script verses): 70% match exactly; 638 verses have 1–2 slips, 61 have 3 or more; about 10 consonant slips per
   1,000 consonants, and long/short vowel slips ≈ 25 per 1,000 vowels. Typical: `ಶ`↔`ಸ`, `ಣ`↔`ನ`, `ರ` dropped or added.
   The stored score does **not** predict these (32 of the 61 worst were stamped 2 or 3).
   **Two apparent "worst" cases are not Kannada errors:** the English file's `sanskrit` field is wrong for **2.3.33.37**
   (it contains the next verse too) and **2.3.13.12** (it holds verse 11's text). The Kannada matches the English transliteration.

## Style notes (not errors)

- "Transcendental" has no single rendering: `ಅಲೌಕಿಕ` ≈ 920 uses, `ಅತೀಂದ್ರಿಯ` ≈ 1,020, `ದಿವ್ಯ` ≈ 140, `ಅತೀತ` ≈ 110, `ಪರಮಾತೀತ` 11.
  Pick one before the remaining cantos run (a glossary line in the prompt).
- Addressing the Lord: `ನಿಮ್ಮ` 467 vs `ನಿನ್ನ` 127 across verses. "False ego": `ಸುಳ್ಳು ಅಹಂಕಾರ` 48 vs `ಮಿಥ್ಯಾ ಅಹಂಕಾರ`/`ಮಿಥ್ಯಾಹಂಕಾರ` 22.
- Meaning slips seen in the 24-verse reading sample: 2.2.2.30 renders "point of neutralization" as `ನಿಷ್ಪಕ್ಷಪಾತದ ಬಿಂದು`
  ("point of impartiality") and has a case-ending slip in the bracket; 2.2.9.17 drops "natural opulences";
  2.3.4.27 uses `ಯಶಸ್ಸು` (success) for "fame". Everything else in the sample was faithful.

## Before running kn cantos 4–12

Send the source `sanskrit` to the transliteration step and convert it by offset rather than rebuilding it from ASCII; strip
verse markers; add `ऽ→ಽ`; add a post-run check for foreign scripts and for `correctness`; settle the glossary above.
Never run `fix-translation-script.js` on SB.
