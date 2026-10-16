# Gita translations in the local database — audit report

**Date:** 2026-10-16 · **Checked:** the seven translated languages (bn hi kn ml mr ta te) of Prabhupāda's Bhagavad-gītā, as they now stand in the **local Postgres** `VerseTranslation` table, against the English in the same database and against S3 (`s3://sanatan-db/json/bhagavat-gita/<lang>/`, read-only).
**This report is the first half of the task. Nothing has been fixed.** Nothing was written to S3. The only database change is the import described in §1. Nothing is committed.

---

## 1. What was imported

`importLanguage` (the admin page's Import button, called directly) for all seven languages, **hidden** (`publish: false`), straight from S3.

| Language | In storage | Created | Updated in place | Unchanged | Missing / conflicts |
|---|---|---|---|---|---|
| bn hi kn ml mr te | 701 each | 701 each | 0 | 0 | 0 / 0 |
| ta | 701 | 517 | 121 | 63 | 0 / 0 |

- The Tamil rows that already existed (184, from an earlier import) were refreshed with yesterday's corrections; their ids were kept.
- **The database now holds 4,907 translation rows (701 × 7)**, each with translation, transliteration and word meanings; **667 of 701 also carry a purport** (the 34 other verses have none in English either). Version `1.0-12-10-26` on every row. **All are hidden** (`isPublished = false`); the English rows are untouched and visible.
- **A second dry-run import after the first reports 701 `unchanged` in every language** — the database equals S3 exactly. Row totals reconcile (21,349 `VerseTranslation` rows across the table).
- **Undo:** `pg_dump` of the table taken before the import, in the scratchpad: `/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/e417c2ef-b00c-4283-804c-642e0b3cc78c/scratchpad/db/VerseTranslation-before-import.sql` (data only, column inserts, 29.5 MB). It is in a temp directory — copy it somewhere permanent if you want to keep it.
- **A labelling problem found on the way:** every row says `translatedBy = 'claude'`, but Tamil (all 701) and 692 of Malayalam's 701 were written by **gpt-6-luna** (the saved stamp says so; the database cannot). The five other languages were written by `claude-sonnet-5-5`. The column comes from a name the pipeline writes into every file regardless of provider.

## 2. Short answer

- **Nothing is missing and nothing is untranslated.** 4,907 of 4,907 verse × language pairs have all four parts; word-meaning counts equal the English in all but 2 (hi 1.11.53, and the corrupt bn 1.10.37). Purports 667/667. No translation or purport is the English left as it was; the only English left over is single words (§3 D, G).
- **No text is in the wrong language.** Every language is in its own script above 85 % of its letters in every text, except the corrupt, Roman and single-English-word cases in §3 (A–D). Hindi and Marathi (same script) were checked with strict word markers: Hindi 0 suspect texts of 1,368; Marathi 2 borderline purports (1.11.10, 1.11.11), and I read 1.11.10: it is real Marathi. No Bengali text shows Assamese letters; no Nepali.
- **There are real defects, and they are few: 65 verse × language pairs of 4,907 (1.3 %)** show something my checks count as real (§3 A–H, J). **34 of them are Bengali, 16 Telugu**, ml 6, hi 4, mr 4, kn 1; **Tamil has none** after yesterday's fixes. Six of the 65 are **completely corrupt** (4 Bengali, 2 Telugu): every part of the verse is garbage bytes. Eight more pairs only differ in layout (§3 I).
- **The saved quality scores overstate the problem.** 1,138 of the 4,907 verses carry a stored score of 1 ("needs rework"); a large part of that is one validator rule (word-count ratio) that misfires in Indian languages. I read 24 randomly chosen word meanings it called "bad" — all 24 were faithful translations; and 4 flagged translations — all complete (§4). Do not use "score 1" as the redo list.
- **What I cannot tell you:** whether the *meaning* is right. No native speaker has read any of it (§6).

## 3. Real findings

"Real" = a rule-based check found it **and** I looked at it (or at its kind) and it is wrong. Verse lists are in `findings.json` beside this file. Verse ids are `chapter.verse` of the Gita (`1.3.11` is book 1, chapter 3, verse 11).

| # | Finding | Where | Cost to fix |
|---|---|---|---|
| A | **Whole verse corrupt** — the translation, transliteration, word meanings and purport are mojibake (Bengali/Telugu UTF-8 bytes read as Latin-1: `à¦¯à¦œà§à¦ž…`), the word list has 1 entry instead of 12 in 1.10.37, and the purport of 1.10.37 is `x`. | **bn** 1.3.11 1.9.11 1.10.37 1.11.25 · **te** 1.3.9 1.11.46 | Redo the verse (AI, ~6 verses) |
| B | **Verse transliteration not in the language's script** | **bn** in Roman: 1.2.29 1.3.39 1.10.13 1.16.15 1.16.20 1.17.7, and partly 1.10.28 · in Devanagari: 1.3.31 | Rule (rebuild from the English IAST) or AI |
| C | **Sanskrit word column in Roman**, 11 words | **te** 1.11.11 | Rule or AI |
| D | **One English word left in the word meanings** — nearly always *even* for *api* (অপি) | **bn** 1.1.38 1.2.5 1.3.8 1.4.36 1.5.4 1.6.25 1.11.32 1.12.10 1.16.20 1.18.17 1.18.60 | One-word patch (AI touch-up) |
| E | **A stray letter of another script** in the middle of the text — Tamil (அ ப ௨), Malayalam (ത ാ ് വ), Bengali ই, Devanagari ऐ क | **te** 1.2.8 1.2.40(ऽ) 1.2.44 1.3.5(ऽ) 1.3.28 1.10.5 1.10.33 1.11.39 1.16.4 · **hi** 1.2.28 · **mr** 1.2.18 · **bn** 1.9.31 · **kn** 1.3.22 | Rule (delete / replace) |
| F | **Quoted Sanskrit left in Roman letters inside a purport** (the other languages convert it) | **bn** 1.9.29 1.10.34 1.18.2 · **te** 1.6.12 · **hi** 1.8.14 | Rule |
| G | **English words left in a purport** | **hi** 1.11.33 ("of Godhead") · **mr** 1.4.5 ("acyuta") · **mr / bn / ml** 1.6.47 ("worship" left in the purport several times) — deliberate in ml (yesterday's report); mr and bn are probably the same, not checked | AI touch-up |
| H | **One broken combining mark** (two vowel signs in a row, or a word starting with a vowel sign) — a single glitch character | **ml** 1.3.3 1.8.10 1.8.22 1.9.26 1.12.20 · **te** 1.2.20 1.6.40 · **hi** 1.18.17 · **bn** 1.1.26 | Rule |
| I | **Layout differs from the English** — never a loss of text: hi 1.11.53 has 17 word entries for 16; mr 1.13.9 purport is split into 7 paragraphs for 1, te 1.10.3 into 3 for 1; 1.11.48's transliteration is 4 lines (the four pādas) for the English 2, in hi mr bn te kn | as listed | Leave, or merge |
| J | **Stray digits in transliteration lines** — a "2" in bn 1.1.31 1.6.33 1.6.46 1.7.4 1.12.20 1.13.22; a "7" in te 1.18.65; a missing "6" in mr 1.14.6 | as listed | Rule |

**Cosmetic, listed separately:** the Devanagari **avagraha ऽ** sits inside Bengali, Telugu and Kannada text instead of the language's own sign (ঽ ఽ ಽ) in **bn 4, te 23, kn 9** verses (`findings.json` → `avagraha`). It is readable and the same as the Sanskrit source, but it is the wrong character in those scripts.

Verse × language pairs with something in A–H or J: **65 — bn 34, te 16, ml 6, hi 4, mr 4, kn 1, ta 0**. Pairs that only differ in layout (I): hi 1.11.48 1.11.53, mr 1.11.48 1.13.9, bn 1.11.48, te 1.10.3 1.11.48, kn 1.11.48.

## 4. What looked wrong and is not

| Flag | Count | Why it is a false alarm |
|---|---|---|
| Word meaning "too short" | 934 entries (hi 113, mr 182, bn 170, ta 99, te 111, kn 128, ml 131) | The check compares word counts with the English. Hindi *परमेश्वर को* ("to the Supreme Personality of Godhead"), Telugu *కృష్ణపక్షము* ("the fortnight of the dark moon") and Tamil *செய்யக்கூடாதது* ("what ought not to be done") are complete in one or two words. **I read 24 chosen at random across all seven languages: 24 faithful** (hi 11.14 *परमेश्वर को* is the most compressed — it drops "Personality of Godhead"). |
| Translation "too short" | 168 (ta 32, bn 36, kn 25, mr 21, ml 21, te 20, hi 13) | Same cause. I read ml 17.11, ml 18.23, kn 17.4, ta 14.11: all complete. Yesterday's report found one real small omission in this group (ta 1.7.30 drops a repeated "the Supreme Personality of Godhead"), so some hide behind the flag — see §5. |
| Purport numbers differ | 35 | Indian number grouping (8,400,000 is written 84,00,000), or a number written in words (*39* → उनतालीसवें in hi 1.3.3). The three in J are the only wrong digits I found. |
| Brackets or quotes differ from the English | purport 239, translation 46, word meanings 34 | Languages use different quotation and bracket conventions; not read. |
| Hindi reads Marathi / Marathi reads Hindi (my first, loose markers) | 6 / 15 | Re-done with strict markers: no confusion (§2). |
| Sanskrit "distance" from the verse | only the six corrupt verses stand out | The transliteration and the Sanskrit word column of every other verse sound like the English IAST of the same verse (distance median 0.00 for hi kn ml mr ta te; bn 0.06 because of the Bengali *v/b* convention, not a defect). |

## 5. The stored scores (what the pipeline thought of its own work)

Lowest part per verse, 1 / 2 / 3, and the model that wrote it.

| Language | Model | Verses scored 1 | 2 | 3 | Parts scored 1: translation / translit. / words / purport |
|---|---|---|---|---|---|
| hi | claude-sonnet-5-5 | 136 | 231 | 334 | 14 / 1 / 116 / 8 |
| mr | claude-sonnet-5-5 | 186 | 249 | 266 | 21 / 2 / 167 / 11 |
| bn | claude-sonnet-5-5 | 214 | 174 | 313 | 39 / 21 / 171 / 15 |
| te | claude-sonnet-5-5 | 134 | 329 | 238 | 22 / 9 / 109 / 12 |
| kn | claude-sonnet-5-5 | 140 | 269 | 292 | 26 / 1 / 115 / 10 |
| ml | gpt-6-luna (692), sonnet (9) | 135 | 555 | 11 | 23 / 3 / 107 / 18 |
| ta | gpt-6-luna (701; 13 verses touched by sonnet yesterday) | 193 | 505 | 3 | 35 / 25 / 139 / 27 |

- **Word meanings are 62–83 % of all parts scored 1** (hi 83, mr 83, kn 76, te 72, ml 71, bn 70, ta 62). In six of the seven languages 84–98 % of the word-meaning score-1s carry the validator's "too short" finding (hi 101 of 116, mr 154 of 167, bn 145 of 171, te 92 of 109, kn 107 of 115, ml 105 of 107); in Tamil it is 86 of 139. The rest have no rule finding or a different one (the model's own doubt, or a script problem). That is the number I would not act on.
- The bn/ta **transliteration** score-1s (21 / 25) *are* the script problems: bn is B above; the ta ones are what yesterday's script pass left (it re-scored only the parts it repaired).
- Where the model wrote a note, it is usually "a native reviewer may want to polish X" — useful as a hint for a reviewer, not a defect list.

## 6. What was not checked

- **Meaning accuracy.** Nobody who reads these languages natively has looked at any of this. My reading of samples can tell script, completeness and obvious wrongness; it cannot tell a good devotional rendering from an acceptable one. Hindi, Marathi, Bengali, Telugu, Kannada, Tamil and Malayalam are each only as reliable as the model that wrote them (§5).
- **Terminology consistency across 701 verses** (one word for "transcendental" etc.) — yesterday's report counted it for ml and ta only.
- **Purports beyond paragraph count, length and the checks above** — I did not read purports for dropped sentences; the length-versus-peers check found nothing outside the six corrupt verses (all other purports are within 0.6×–1.7× of what the peer languages' lengths predict).
- **The 11 word-meaning and 168 translation "too short" cases at the very bottom of the ratio** — I read a handful, not all.
- **Anything about what the app shows.** The rows are hidden; the app reads `transliteration` of these rows but not `wordMeanings`, and nothing marks a text as machine-made (`backend/CLAUDE.md`, translation import).

## 7. Proposed fixes — not done, waiting for your word

In order of value for the cost; each ends with re-running this audit (`tools/`) and a re-import of that language.

1. **Redo the six corrupt verses** (A) with the existing `scripts/redo-translation-parts.js propose` / `apply` — whole verse, claude-sonnet-5-5, about 6 verses, a few cents. Back up first, as yesterday. Then import bn and te again (only those rows change).
2. **Rule-based script pass for bn / te / kn / hi / mr** — the ml/ta pass (`scripts/fix-translation-script.js`) has rules only for those two languages. B, C, E, F, H, J and the avagraha would need the same rules for Bengali, Telugu and Kannada (the English IAST → script converter exists in `scripts/lib/translation-script.js` for the Dravidian scripts I used; Bengali and Devanagari need checking, so this step needs a look at what the converter can do before I promise it). No model cost.
3. **One-word patches** — D (11 bn verses, "even") and G (≈ 5) through the touch-up tool built yesterday. Cents.
4. **Fix the validator, then re-score before anyone runs another model pass:** word-meaning and translation length checks need a language-aware ratio (or none) for Indian languages — otherwise ~1,100 verses stay "needs rework" for no reason and an automatic redo of them would cost money and risk the good text.
5. **Label the rows properly** (`translatedBy` / a provider column from the stamp) so the database can say gpt-6-luna vs Claude.
6. **Native-speaker review** of whatever you intend to publish, language by language — the real gap.
7. **Then** decide on publishing (`isPublished`), re-run the offline book export (`node scripts/export-book-cache.js` on the server), and teach the app to read `wordMeanings`.

## 8. Re-running this audit

All of it is read-only. From `backend/`, with the dev `.env` sourced (`set -a; source .env; set +a`) and Node 20:

```
# 1. a read-only copy of S3, for the saved model / score stamps
for l in bn hi kn ml mr ta te; do aws s3 sync s3://sanatan-db/json/bhagavat-gita/$l/ scripts/translation-audit-2026-10-16/output/s3now/$l/; done
# 2. the audit (writes output/audit-db.json, ~8 s)
node scripts/translation-audit-2026-10-16/tools/audit-db.mjs
# 3. group the findings into the table in §3 (writes findings.json)
node scripts/translation-audit-2026-10-16/tools/categorise.mjs
# the import itself (DRY=1 only previews; rows stay hidden)
DRY=1 OUT=/tmp/import.json node scripts/translation-audit-2026-10-16/tools/import-all.mjs
```

| File | What it is |
|---|---|
| `findings.json` | verse lists per category per language (what §3 counts) |
| `tools/audit-db.mjs` | the audit: database vs English vs the saved stamps; uses the repo's own validator (`assessLanguage`) plus mojibake, foreign-script, Roman-letter, Hindi/Marathi, length and Sanskrit-sound checks |
| `tools/categorise.mjs` | turns the audit's findings into `findings.json` |
| `tools/import-all.mjs` | imports the seven languages (hidden), or previews |

The tables in §2 and §5 were computed from `output/audit-db.json` with throwaway one-liners that are not kept; every number can be re-derived from that file (each record carries the model, scores and notes from the saved stamp).
