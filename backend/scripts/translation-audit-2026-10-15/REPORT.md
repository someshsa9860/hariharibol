# Malayalam & Tamil Gita translations — audit report

**Date:** 2026-10-15 · **Checked:** `json/bhagavat-gita/ml/` and `json/bhagavat-gita/ta/` on S3 (bucket `sanatan-db`), 18 chapters, 701 verses each.
**Snapshots** were downloaded at about 21:40 IST on 2026-10-15; the translation run's checkpoint said `running: false`. Every number below comes from those snapshots. S3 has not been re-read since.
**The audit itself changed nothing.** The fixes it asked for were made the next day — see **Update 2026-10-16** below. Sections 1–9 are the audit as written on 2026-10-15 and describe the state *before* those fixes. The earlier Tamil corrections (ch 1–3 and 4.1–22) were written to S3 before the audit and are backed up (§6).

---

## Update 2026-10-16 — the fixes were applied

**What was done, in order** (everything below is on S3; nothing is in the database, nothing is committed):

1. **The AI redo — lists A and B, 30 verses** (17 ml, 13 ta), with `scripts/redo-translation-parts.js` (`propose`, then `apply`). The worklist is `redo-list.json` beside this file. It was written by **Claude Sonnet 5.5** (`claude-sonnet-5-5`, not the pipeline's default gpt-6-luna) and cost about **$0.35** in all, retries included; the redone parts are stamped with that provider and model.
   - **List A (ml, wrong language): redone whole** — only the parts asked for (translation, word meanings, purport), merged into the saved verse with the pipeline's own `mergeEntry`. 1.2.7 1.2.42 1.10.23 1.13.6 1.16.23 1.17.13 1.18.14 whole; 1.18.42 and 1.18.45 translation + word meanings; 1.12.5 word meanings.
   - **List B (English left in the text): touched up, not retranslated.** The code finds each Roman-letter run, together with a hyphen suffix, a following light verb or copula, and a broken stub in front of it; the model is asked only for the wording of each numbered gap, the wording is checked (language letters only, ≤ 80 characters, never reuses the broken stub), and it is filled in. Nothing else in the text can change. Words that are meant to stay (Sanskrit roots in 1.6.47, `yoga-balena` in ml 1.8.10, `na`/`tu` in ta 1.11.54) are converted to the language's script by rule instead of sent to the model.
   - **Glossary (so the redone verses agree).** Counts are from the saved corpus. **ta:** transcendental → அதீத (103 of 288 verses; ஆழ்நிலை 55, அப்பாற்பட்ட 51), transcendentalist → ஆழ்நிலைவாதி (the form the corpus uses in 1.6.15/19/37/44, 1.15.11), material → ஜட (59 of 111; பௌதிக 27), living entity → உயிர்வாழி (34 of 46). **ml:** transcendental → അതീന്ദ്രിയ (239 of 288; അതീത 58), material → ഭൗതിക (107 of 111). Chosen because they are what most of the corpus already says — not because they are the best Tamil or Malayalam. The glossary is passed in the touch-up prompt only; the whole-verse redo (list A) was not given one, so the ml redone verses use whatever the model chose.
   - **Backups:** every changed chapter file was copied first to `s3://sanatan-db/json-backup-2026-10-16/json/bhagavat-gita/<lang>/ch-<n>.json`. The copy taken at the first write of the day is kept, so these are the files **as they were before either step**; five of them were compared byte for byte with the 2026-10-15 snapshots and are identical.
2. **The script pass — `scripts/fix-translation-script.js --langs ml,ta --apply`** (rules in `scripts/lib/translation-script-fix.js`), all 36 chapter files. It rebuilt 520 ml and 511 ta transliteration lines and 2,293 ml and 1,415 ta Sanskrit words from the English IAST, converted the quoted Sanskrit in purports, and removed stray foreign letters and superscript digits. It stamps what it repaired `scriptFix` and re-scores only those parts; the translation version is untouched.
3. **Checked afterwards:** a second dry run finds **0** verses to change in either language; the validator finds **no** script or foreign-letter problem in either language; no verse's score fell (1,402 verses); and compared with the 2026-10-15 snapshots the only validator finding that is new is three Malayalam word meanings now flagged "too short" (1.2.42 word 5, 1.17.13 words 3 and 4) — read, they are faithful (*avipaścitaḥ* "less intelligent men" → അല്പജ്ഞാനികളായ മനുഷ്യർ; *mantra-hīnam* → വേദമന്ത്രജപമില്ലാതെ; *adakṣiṇam* → പുരോഹിതർക്ക് ദക്ഷിണയില്ലാതെ), just shorter than the English because Malayalam says it in one word.

**Scores now** (verse level, lowest part; 1 / 2 / 3): **ml 135 / 555 / 11** (was 334 / 358 / 9); **ta 193 / 505 / 3** (was 287 / 414 / 0). Transliteration scored 1: ml 3, ta 25. What is still 1 is the "too short" flag (list D) and the model's own doubt (list E), plus the cases below.

**Still not done / left on purpose**
- **Meaning accuracy has never been read by a native speaker** — not the original text, and not the ~30 verses redone or touched up now. The new wording is model-made. The three ml "transmigrate" wordings in 1.13.22 differ by context (മാറുന്നു / ദേഹാന്തരപ്രാപ്തി നേടുന്നത് / മാറിക്കൊണ്ടിരിക്കുന്നത്); a Malayalam reader should say whether one word should win.
- **List C (Tamil rule gaps) is now rules**, not hand fixes. 1.2.64 is a deliberate leftover (the English source line is itself damaged). ml 1.6.47 keeps "worship" four times in the purport on purpose (see the worklist); it is the only `english-word` leftover the script pass reports.
- **List D ("too short") was only sampled, not worked.** Translations flagged: ml 21, ta 32. In characters (a fairer measure for agglutinative languages) a flagged translation is a median 0.81× (ml) and 0.94× (ta) the English length, against 1.03× and 1.05× for unflagged ones; the lowest is 0.66× (ml 1.17.11). I read three of the lowest — ml 1.17.11, ml 1.10.36, ta 1.7.30. The two Malayalam ones are complete; **ta 1.7.30 drops the closing "the Supreme Personality of Godhead"** (a repeated phrase, so a small omission, not a lost sentence). The word-meaning flags (ml 131, ta 99) were not read beyond the three above. So: the flag looks mostly like a false alarm, but small omissions do hide behind it.
- **List E (the model's own doubt) was not touched.**
- **The pipeline weaknesses in §8 are not fixed** — the next run of the translate CLI or the admin page will again write Sanskrit lines in the wrong script until the prompt or the pipeline is changed. Use the script pass afterwards.
- **The app and the import still do not read `wordMeanings`** of the imported rows, and nothing marks a text as machine-made. Nothing was imported into the database; the app's offline export has not been re-run.

**New code (all untracked, nothing committed)**

| File | What it is |
|---|---|
| `scripts/fix-translation-script.js` + `scripts/lib/translation-script.js` + `scripts/lib/translation-script-fix.js` | the script pass (dry run by default, `--apply` backs up and writes conditionally, reads back) |
| `scripts/redo-translation-parts.js` + `scripts/lib/translation-redo.js` | the redo / touch-up (`propose` writes a proposal file and touches nothing; `apply` checks every verse still equals what the proposal was made from, backs up, writes, reads back) |
| `translation-audit-2026-10-15/redo-list.json` | the worklist for lists A and B |
| `test/translation-script.test.js`, `test/translation-script-fix.test.js`, `test/translation-redo.test.js` | 155 tests; run under Node 20 with `node --test test/translation-redo.test.js test/translation-script.test.js test/translation-script-fix.test.js` |

---

## 1. Short answer

- **Nothing is missing.** Both languages have all 701 verses and all four parts. In every verse the word list, the transliteration lines and the purport paragraphs match the English in count.
- **The big problem is script, not prose.** The Sanskrit (verse transliteration and the Sanskrit column of the word list) is often in the wrong script. A rule can fix that without an AI.
- **Malayalam:** 9 translations, 10 word-meaning lists and 7 purports are in another language (Kannada, Tamil, Nepali, Hindi, Gujarati, Marathi). 276 verses have Devanagari in the transliteration, and 178 in the Sanskrit word column.
- **Tamil:** no text is in the wrong language. The problems are other-script letters, `:` or `꞉` used as a visarga, and superscript digits in the Sanskrit lines (323 verses have a flawed transliteration line, 268 a flawed Sanskrit word column), mostly in ch 4.23–18. A few English words are left in some texts.
- **The real AI work is small:** about 17 verses per language (§4, list A and B). The rest is script work, then spot-checks.
- **Meaning accuracy was not reviewed** (§7). "The prose is mostly fine" means: no structural, script or language fault found, and the model's own ratings are mostly 2 or 3. It is not a native-speaker verdict.
- **A script pass (built, dry run only, not applied)** brings the verses still needing a second round, by today's validator, from **385 to 154 (ml)** and **380 to 221 (ta)**. Of those, only about 17 per language are real or odd cases; the others are "too short" flags (110 ml, 112 ta) or the model's own doubt (27 ml, 92 ta).

## 2. The numbers (what the run saved)

Score 3 = perfect, 2 = good, 1 = needs a second round (the lowest of the model's own rating and the validator's cap).

| Part | Malayalam 1 / 2 / 3 | Tamil 1 / 2 / 3 |
|---|---|---|
| Translation (701) | 32 / 432 / 237 | 35 / 466 / 200 |
| Transliteration (701) | 237 / 362 / 102 | 128 / 571 / 2 |
| Word meanings (701) | 262 / 389 / 50 | 220 / 480 / 1 |
| Purport (667 verses have one) | 27 / 573 / 67 | 29 / 581 / 57 |
| **Verse level (lowest part)** | **334** / 358 / 9 | **287** / 414 / 0 |

Re-scored with today's validator, which checks foreign letters more strictly than the run did, the "1" counts are: ml translation 32, transliteration 287, word meanings 263, purport 66 (verse level 385); ta translation 39, transliteration 263, word meanings 231, purport 57 (verse level 380).

**Who wrote it:** every verse is stamped `openai / gpt-6-luna / effort off / prompt 6 / version 1.0-12-10-26`. One Tamil verse has prompt 7.
**Tamil, two halves:** ch 1–3 and 4.1–22 (184 verses) were corrected earlier on 2026-10-15. Chapters 4.23–18 (517 verses) come straight from the later run and still carry the defects.

## 3. What is wrong

### 3a. Malayalam

| Problem | How many | Needs |
|---|---|---|
| Transliteration in **Devanagari** instead of Malayalam script | 276 verses (223 mostly Devanagari) | rule |
| **Sanskrit word column** in Devanagari | 178 verses | rule |
| **Translation in another language**: 1.2.7 Kannada, 1.2.42 Tamil, 1.10.23 Tamil, 1.13.6 Nepali, 1.16.23 Hindi, 1.17.13 Gujarati, 1.18.14 Hindi, 1.18.42 Marathi, 1.18.45 Marathi | 9 | **AI** |
| **Purport in another language** (the same verses, except 1.18.42 and 1.18.45) | 7 | **AI** |
| **Word meanings in another language** | 10: the nine above plus 1.12.5 | **AI** |
| **English left in Roman letters**: translation 1.14.20 ("embodied being"); purports 1.2.13 1.3.19 1.6.47 1.13.3 1.13.22. Also 1.8.10, which is Roman Sanskrit ("yoga-balena"), not English | 1 + 6 | **AI** or by hand |
| Sanskrit quotes inside purports in Devanagari (15 runs) or Roman IAST, plus stray single letters of Devanagari, Bengali or Kannada in purports and word meanings | 55 verses (86 runs) in purports | rule |
| Validator says "too short" (ratios 0.29–0.39 for translations; **not verified** that it is a false alarm in Malayalam) | 21 translations, 103 word lists, 1 purport | spot-check |
| Parentheses or quotes do not pair (minor) | 47 findings in 46 purports, 5 translations, 1 word list | look |

The validator's "numbers differ" finding on the purport of 1.8.3 is a **false alarm**.

### 3b. Tamil

| Problem | How many | Needs |
|---|---|---|
| Transliteration with Devanagari (`ऽ` `ः` letters), Gujarati, Bengali, Kannada, Telugu or Malayalam letters, `꞉`, Tamil `ஂ`, or **superscript digits ²³⁴** | 323 verses (162 of them contain Devanagari), mostly ch 4.23–18 | rule |
| **`:` or `꞉` used as a visarga** in the Sanskrit lines and word lists | 86 verses | rule |
| **Sanskrit word column** with the same kinds of defect | 268 verses | rule |
| 26 hand-corrected verses (ch 1–4) still use the superscript style (²³⁴). The rest of the corrected part uses plain letters. | 26 verses | rule (unify) |
| **Sanskrit quotes in purports** in Roman letters (66 runs) or Devanagari (5 runs), plus stray 1–3 letters of Gujarati, Telugu, Malayalam or Devanagari inside Tamil words (52 runs in purports, 4 in translations, 3 in word meanings) | see appendix lists | rule |
| **English left in Roman letters**: translations 1.6.8 1.6.40 1.6.47 1.7.10 1.8.3 1.17.25 ("transcendence", "transcendental" …); purports 1.7.6 1.7.17 1.11.5 1.12.8 1.14.5; word meaning 1.9.4 ("entities"); purport 1.11.54 ("tu", "na"). 1.6.47 also has Roman Sanskrit roots ("bhaj…") | about 14 | **AI** or by hand |
| Validator says "too short" (ratios 0.38–0.49 for translations; false alarm confirmed on ch 1–4, not checked on the rest) | 32 translations, 86 word lists, 3 purports | spot-check |
| Numbers differ from the English | 1.15.13 (transliteration and word list: plain digits 3/4 in the Sanskrit line) is **real**. 1.18.57 (word list) is a **false alarm** | look |
| Parentheses or quotes do not pair (minor) | 44 findings in 42 purports, 2 translations, 2 word lists | look |

1.9.5, 1.10.2, 1.10.16 and 1.11.8 are **not** wrong-language texts: each has 1–3 stray Telugu or Gujarati letters inside a Tamil word, which the rule fixes. Tamil has no wrong-language translation, purport or word-meaning list.

## 4. Tomorrow's worklist (in this order)

**A. AI redo — wrong-language texts (Malayalam only).**
1. Whole verse (translation + word meanings + purport): **1.2.7, 1.2.42, 1.10.23, 1.13.6, 1.16.23, 1.17.13, 1.18.14**.
2. Translation + word meanings: **1.18.42, 1.18.45**.
3. Word meanings only: **1.12.5**.

Do this **before** the script pass. Otherwise the rule will push this foreign text into Malayalam script letter by letter, which is nonsense (§5, caveat 2).

**B. English / Roman words left in (AI, or by hand — each is one word or a few).**
- ml: translation 1.14.20; purports 1.2.13, 1.3.19, 1.6.47, 1.13.3, 1.13.22; Roman Sanskrit in 1.8.10.
- ta translations: 1.6.8, 1.6.40, 1.6.47, 1.7.10, 1.8.3, 1.17.25. ta purports: 1.6.47, 1.7.6, 1.7.17, 1.11.5, 1.12.8, 1.14.5, 1.11.54. ta word meaning: 1.9.4.
- Decide **one word for "transcendental"** in each language first, so all the redone verses agree.

**C. Apply the script pass** (not built as an apply step yet; §5), then the small rule gaps by hand (Tamil):
- 1.7.21, 1.11.46, 1.15.7: a stray `ृ`.
- 1.15.13: plain digits 3/4 in the Sanskrit line and the words.
- 1.10.14 and 1.11.32: the `ʼ` (U+02BC) spelling.
- 1.2.64: leave it alone (the English source has a typo, "orviyuktaistu"; the Tamil line was hand-fixed).

**D. Spot-check the "too short" flags.** Translations at the lowest ratios first (ml 0.29–0.39, ta 0.38–0.49); then the word lists (ml 103, ta 86 verses); purports ml 1.18.39 and ta 1.2.37, 1.18.30, 1.18.39. Lists are in the appendix. The earlier appendix with the ratio per verse was lost when the scratch folder was cleared; re-run `tools/simulate.mjs` (after fixing its paths) to get them back.

**E. Optional — the model's own doubt.** The model rated itself 1 on: ml translation 7, transliteration 25, word meanings 9, purport 19; ta translation 3, transliteration 93, word meanings 56, purport 24 (after the pass, the transliteration "1"s are stale, see §5). Redo those only for a stricter result.

**Do not spend AI on the Sanskrit columns.** Transliteration and the Sanskrit word column can be rebuilt from the English IAST by rule, at no cost and with no script errors. The model keeps getting the script wrong.

## 5. The script pass (dry run, nothing applied)

I built converters (English IAST to Malayalam or Tamil script; other Indic scripts to Malayalam, or via IAST to Tamil). The pass replaces **only** text that has a script flaw and keeps all other model text. It regenerates transliteration lines and the Sanskrit `word` column from the English IAST, and converts stray or quoted Sanskrit in prose. It does **not** touch wrong-language prose or English words; those need translation (§4 A and B).

I applied it in memory to the snapshots and re-ran the pipeline's own validator:

| Verses scoring 1 | ml before → after | ta before → after |
|---|---|---|
| Transliteration | 287 → 25 | 263 → 93 |
| Word meanings | 263 → 113 | 231 → 142 |
| Purport | 66 → 25 | 57 → 29 |
| Translation | 32 → 32 | 39 → 35 |
| **Verse level (lowest part)** | **385 → 154** | **380 → 221** |

Of the 154 (ml) still at 1: 17 real or odd cases, 110 only a "too short" flag, 27 only the model's own doubt. Of the 221 (ta): 17, 112 and 92.

What it changed in the dry run: ml 520 transliteration lines, 2,431 word entries (185 verses), 86 purport runs, 87 word-meaning runs, 319 verses in all; ta 509 lines, 1,397 word entries, 148 purport runs, 368 verses in all.

**Read these before applying it:**
1. **The remaining transliteration "1"s are stale.** After the pass the validator finds no transliteration fault in ml and only the 1.15.13 numbers in ta (25 = 25 in ml, 93 = 93 in ta: they equal the model's old self-rating). When rule-built text is stamped, those should be reset and the part re-scored.
2. **The rule needs a strict wrong-language check first.** The dry run turned Marathi, Hindi, Nepali, Kannada, Tamil and Gujarati prose into Malayalam letters one letter at a time (88 changes, all inside the 10 wrong-language verses), and counted 1.18.45 as "fixed" when it is not. The rule to add: in a translation or word-meaning field, any run of 4 or more letters not in the language's own script is wrong-language, and the text goes to the AI list instead. Only purports may hold Sanskrit quotes (checked: all 15 ml and 5 ta Devanagari purport conversions are genuine Sanskrit quotes).
3. **Tamil convention.** The rule writes plain letters (no superscripts), `ஃ` for visarga and `’` (U+2019) for avagraha, matching the corrected half. The superscript style would need a different converter. U+02BC counts as a letter for the validator.
4. **An apply step does not exist yet.** The dry run only writes patched copies in scratch. Applying needs: a backup, the strict rule, a stamp reset and a re-score.

## 6. How to run the redo (checked against the code, not run)

- `node scripts/translate-claude.js --help` is the source of truth. Useful flags: `--verse 1.2.7` (one verse), `--langs ml`, `--provider anthropic --model claude-sonnet-5-5`, `--dry-run` (shows cost, calls nothing).
- **A verse already translated under the current `TRANSLATION_VERSION` is skipped.** To redo it, change the version (in `backend/.env` or the shell). After a bump **every** verse of that language counts as not done, so always use `--verse` (or a narrow `--chapters`) and run `--dry-run` first. There is no verse-list option; loop over `--verse`. A "redo selected verses" mode is not built.
- **There is no `--parts` flag.** The CLI redoes all four parts of a verse, so the Sanskrit columns may come back wrong; run the script pass afterwards. The admin Translations page lets you choose a provider and model per part; I did not confirm whether it can switch a part off.
- Output is stamped `translatedBy: 'claude'` whichever provider wrote it; the stamp's provider and model fields tell the truth.
- **Back up before any S3 write.** Re-check that the run's checkpoint says `running: false` and that S3 still equals these snapshots. Earlier Tamil backups: `s3://sanatan-db/json-backup-2026-10-15-before-ta-fix/json/bhagavat-gita/ta/` and `json-backup-2026-10-15/`. **Malayalam has not been backed up yet**; no write has touched it.
- Do not run `translation-e2e.js`. Do not run the CLI while the worker is working a run for the same language.

## 7. What I did not check

- **Meaning accuracy** was not reviewed for either language. A text can be fluent, correctly scripted and still wrong. Everything above comes from structure, script, language detection, the validator and the model's ratings. A native speaker should spot-check, especially devotional wording.
- The validator's "too short" flags are unexamined in Malayalam and beyond ch 1–4 in Tamil. Longer-word languages probably cause many false alarms, but I did not read them.
- The "needs AI" lists come from rules (foreign-script runs of 4+ letters in translations and word meanings; Latin words with no diacritics). A wrong-language text shorter than that would be missed.
- The rule's output has not been read by a native speaker.
- Counts come from the 21:40 IST snapshots, not live S3.

## 8. Pipeline weaknesses behind this (for later)

- The prompt asks for Sanskrit in the language's own script and says nothing about the avagraha or superscripts. The validator checks the script share and foreign characters, not meaning.
- "Too short" misfires on agglutinative languages (Tamil confirmed on ch 1–4; Malayalam unverified).
- Generating the Sanskrit lines by rule would remove the largest source of these defects.
- `translatedBy: "claude"` is stamped on OpenAI and Gemini output.
- The app and the offline export do not yet read the new `VerseTranslation` `wordMeanings`, and nothing marks a text as machine-made.

## 9. Files and state

- This report: `backend/scripts/translation-audit-2026-10-15/REPORT.md`. `lists.json` holds the verse lists behind the appendix.
- `tools/` holds copies of the scripts I used (`script.mjs` converters, `fixdet.mjs` rules, `simulate.mjs` dry run, `census.mjs`, `lists.mjs`, `runs.mjs`, `runs2.mjs`, `marks.mjs`, `sanskrit.mjs`, `conv-stats.mjs`, `verify*.mjs`, `build-appendix.mjs`). **They have absolute paths into a temporary scratch folder that has since been cleared.** They need the snapshots re-downloaded from S3 and the paths edited before they run. Reference copies only.
- The code work from before this audit (gpt-6-luna as the default provider, the lanes, the admin page) is in commit `e216f6c` ("updates"). The audit itself added no code. The scripts, libraries and tests listed in the 2026-10-16 update are new and untracked, as is this folder. Nothing was committed or pushed.

---

## Appendix: verse lists

IDs are `book.chapter.verse`; all are Gita (`1.<chapter>.<verse>`). "After the pass" means the dry run of §5.

### Malayalam

<details><summary>Malayalam: translation still at score 1 after the pass (32)</summary>

1.2.7 1.2.42 1.2.44 1.2.52 1.6.5 1.6.12 1.7.30 1.8.9 1.8.24 1.9.15 1.10.23 1.10.36 1.13.6 1.13.27 1.13.35 1.14.11 1.14.14 1.14.15 1.14.18 1.14.20 1.16.23 1.17.4 1.17.11 1.17.12 1.17.13 1.17.20 1.18.14 1.18.21 1.18.23 1.18.42 1.18.45 1.18.67

</details>

<details><summary>Malayalam: transliteration still at score 1 after the pass (stale, see §5) (25)</summary>

1.2.29 1.2.42 1.2.64 1.3.17 1.4.33 1.6.8 1.6.23 1.7.12 1.7.22 1.8.8 1.8.27 1.9.16 1.9.30 1.10.16 1.10.23 1.11.3 1.11.36 1.12.16 1.13.6 1.14.13 1.16.23 1.17.13 1.18.23 1.18.42 1.18.58

</details>

<details><summary>Malayalam: word meanings still at score 1 after the pass (113)</summary>

1.1.7 1.1.12 1.1.14 1.1.35 1.1.37 1.1.42 1.1.43 1.1.44 1.2.2 1.2.7 1.2.14 1.2.27 1.2.30 1.2.41 1.2.42 1.2.45 1.2.46 1.2.47 1.2.49 1.2.50 1.2.51 1.2.52 1.2.55 1.2.59 1.2.64 1.2.66 1.3.3 1.3.28 1.3.29 1.3.30 1.3.31 1.3.41 1.4.6 1.4.23 1.4.27 1.4.28 1.4.31 1.4.36 1.5.10 1.5.12 1.5.13 1.5.14 1.5.17 1.6.6 1.6.7 1.6.10 1.6.20 1.6.28 1.6.29 1.6.41 1.6.42 1.7.3 1.7.6 1.7.8 1.7.16 1.7.19 1.7.29 1.8.3 1.8.10 1.8.11 1.8.18 1.8.24 1.8.25 1.8.28 1.9.7 1.9.28 1.10.16 1.10.23 1.10.26 1.11.13 1.11.14 1.11.16 1.11.31 1.11.48 1.11.54 1.12.3 1.12.5 1.12.9 1.13.3 1.13.6 1.13.9 1.13.22 1.13.27 1.13.35 1.14.15 1.14.18 1.15.2 1.15.7 1.15.10 1.16.3 1.16.4 1.16.23 1.17.4 1.17.9 1.17.10 1.17.11 1.17.13 1.17.17 1.17.19 1.18.12 1.18.14 1.18.23 1.18.28 1.18.29 1.18.30 1.18.31 1.18.38 1.18.41 1.18.42 1.18.49 1.18.61 1.18.67 1.18.74

</details>

<details><summary>Malayalam: purport still at score 1 after the pass (25)</summary>

1.2.7 1.2.13 1.2.40 1.2.42 1.3.19 1.5.15 1.5.17 1.6.12 1.6.23 1.7.10 1.8.3 1.10.23 1.10.42 1.11.55 1.12.20 1.13.3 1.13.6 1.13.22 1.13.35 1.14.27 1.16.23 1.17.13 1.18.14 1.18.39 1.18.72

</details>

<details><summary>Malayalam: translations flagged "too short" (21)</summary>

1.2.44 1.2.52 1.6.5 1.7.30 1.8.9 1.8.24 1.9.15 1.10.36 1.13.27 1.13.35 1.14.11 1.14.14 1.14.15 1.14.18 1.17.4 1.17.11 1.17.12 1.17.20 1.18.21 1.18.23 1.18.67

</details>

<details><summary>Malayalam: word lists flagged "too short" (103)</summary>

1.1.7 1.1.12 1.1.14 1.1.35 1.1.37 1.1.42 1.1.43 1.1.44 1.2.2 1.2.14 1.2.27 1.2.30 1.2.41 1.2.45 1.2.46 1.2.47 1.2.49 1.2.50 1.2.51 1.2.52 1.2.55 1.2.59 1.2.64 1.2.66 1.3.3 1.3.28 1.3.29 1.3.30 1.3.31 1.3.41 1.4.6 1.4.23 1.4.27 1.4.28 1.4.31 1.4.36 1.5.10 1.5.12 1.5.13 1.5.14 1.5.17 1.6.6 1.6.7 1.6.10 1.6.20 1.6.28 1.6.29 1.6.41 1.6.42 1.7.3 1.7.8 1.7.16 1.7.19 1.7.29 1.8.3 1.8.10 1.8.11 1.8.18 1.8.24 1.8.25 1.8.28 1.9.7 1.9.28 1.10.23 1.10.26 1.11.13 1.11.14 1.11.16 1.11.31 1.11.48 1.11.54 1.12.3 1.12.9 1.13.3 1.13.9 1.13.22 1.13.27 1.13.35 1.14.15 1.14.18 1.15.2 1.15.7 1.15.10 1.16.3 1.16.4 1.17.4 1.17.9 1.17.10 1.17.11 1.17.17 1.17.19 1.18.12 1.18.23 1.18.28 1.18.29 1.18.30 1.18.31 1.18.38 1.18.41 1.18.49 1.18.61 1.18.67 1.18.74

</details>

<details><summary>Malayalam: purports flagged "too short" (1)</summary>

1.18.39

</details>

### Tamil

<details><summary>Tamil: translation still at score 1 after the pass (35)</summary>

1.1.40 1.2.11 1.2.19 1.2.20 1.2.44 1.2.52 1.2.71 1.4.22 1.5.22 1.5.25 1.6.23 1.6.40 1.7.9 1.7.10 1.7.28 1.7.30 1.8.10 1.9.25 1.10.3 1.10.22 1.10.24 1.10.36 1.12.14 1.14.11 1.14.15 1.15.18 1.17.6 1.17.11 1.17.20 1.17.21 1.18.23 1.18.30 1.18.37 1.18.59 1.18.71

</details>

<details><summary>Tamil: transliteration still at score 1 after the pass (stale, see §5) (93)</summary>

1.1.6 1.1.9 1.1.28 1.1.30 1.1.42 1.2.29 1.2.44 1.2.64 1.2.69 1.3.5 1.3.7 1.3.11 1.3.12 1.3.19 1.3.24 1.3.33 1.4.20 1.4.24 1.4.28 1.4.33 1.4.34 1.4.36 1.5.10 1.5.20 1.6.1 1.6.9 1.6.14 1.6.17 1.6.18 1.6.39 1.7.1 1.7.10 1.7.13 1.7.27 1.7.28 1.8.8 1.8.12 1.8.15 1.8.19 1.9.4 1.9.6 1.9.18 1.9.30 1.10.2 1.10.11 1.10.18 1.10.22 1.10.25 1.10.26 1.10.35 1.11.8 1.11.12 1.11.18 1.11.24 1.11.32 1.11.45 1.11.46 1.11.49 1.11.51 1.12.11 1.12.13 1.12.15 1.12.16 1.13.6 1.13.7 1.13.10 1.13.20 1.13.23 1.13.34 1.14.3 1.14.5 1.14.19 1.14.25 1.15.6 1.15.13 1.15.18 1.15.19 1.15.20 1.16.22 1.17.22 1.18.8 1.18.11 1.18.17 1.18.21 1.18.31 1.18.32 1.18.34 1.18.40 1.18.45 1.18.47 1.18.48 1.18.64 1.18.69

</details>

<details><summary>Tamil: word meanings still at score 1 after the pass (142)</summary>

1.1.6 1.1.25 1.1.35 1.1.42 1.1.43 1.1.44 1.2.2 1.2.9 1.2.25 1.2.27 1.2.29 1.2.32 1.2.41 1.2.42 1.2.46 1.2.47 1.2.50 1.2.52 1.2.54 1.2.55 1.2.59 1.2.64 1.2.65 1.2.66 1.3.12 1.3.15 1.3.16 1.3.17 1.3.19 1.3.28 1.3.29 1.3.31 1.3.41 1.4.6 1.4.20 1.4.23 1.4.24 1.4.28 1.4.31 1.4.34 1.4.36 1.5.10 1.5.12 1.5.14 1.5.26 1.6.6 1.6.7 1.6.9 1.6.17 1.6.18 1.6.20 1.6.23 1.6.28 1.6.33 1.6.40 1.6.41 1.6.42 1.7.3 1.7.10 1.7.16 1.7.27 1.8.15 1.8.18 1.8.19 1.8.25 1.8.28 1.9.4 1.9.7 1.9.18 1.9.28 1.10.2 1.10.14 1.10.22 1.10.23 1.10.26 1.10.27 1.10.35 1.11.8 1.11.12 1.11.16 1.11.18 1.11.24 1.11.31 1.11.32 1.11.45 1.11.49 1.11.51 1.12.3 1.12.4 1.12.11 1.12.12 1.12.13 1.12.15 1.12.16 1.13.3 1.13.6 1.13.7 1.13.9 1.13.22 1.13.27 1.13.35 1.14.5 1.14.12 1.14.13 1.14.15 1.14.18 1.14.19 1.15.6 1.15.10 1.15.13 1.15.19 1.15.20 1.16.3 1.16.4 1.16.13 1.16.19 1.16.22 1.17.4 1.17.9 1.17.10 1.17.11 1.17.13 1.17.17 1.17.21 1.17.25 1.17.26 1.18.11 1.18.12 1.18.21 1.18.23 1.18.24 1.18.30 1.18.31 1.18.32 1.18.38 1.18.40 1.18.45 1.18.48 1.18.57 1.18.61 1.18.67 1.18.74

</details>

<details><summary>Tamil: purport still at score 1 after the pass (29)</summary>

1.2.17 1.2.37 1.2.38 1.2.41 1.2.60 1.4.8 1.6.8 1.6.23 1.6.33 1.6.40 1.6.47 1.7.1 1.7.6 1.7.10 1.7.17 1.7.21 1.9.2 1.9.4 1.10.42 1.11.5 1.11.8 1.11.46 1.13.3 1.13.11 1.14.5 1.15.7 1.16.24 1.18.30 1.18.39

</details>

<details><summary>Tamil: translations flagged "too short" (32)</summary>

1.1.40 1.2.11 1.2.19 1.2.20 1.2.44 1.2.52 1.2.71 1.4.22 1.5.22 1.5.25 1.7.9 1.7.28 1.7.30 1.8.10 1.9.25 1.10.3 1.10.22 1.10.24 1.10.36 1.12.14 1.14.11 1.14.15 1.15.18 1.17.6 1.17.11 1.17.20 1.17.21 1.18.23 1.18.30 1.18.37 1.18.59 1.18.71

</details>

<details><summary>Tamil: word lists flagged "too short" (86)</summary>

1.1.25 1.1.35 1.1.42 1.1.43 1.1.44 1.2.2 1.2.9 1.2.27 1.2.32 1.2.41 1.2.42 1.2.46 1.2.47 1.2.50 1.2.52 1.2.54 1.2.55 1.2.59 1.2.64 1.2.65 1.2.66 1.3.12 1.3.15 1.3.28 1.3.29 1.3.31 1.3.41 1.4.6 1.4.23 1.4.31 1.5.12 1.5.14 1.5.26 1.6.6 1.6.7 1.6.17 1.6.20 1.6.28 1.6.40 1.6.41 1.6.42 1.7.3 1.7.16 1.8.18 1.8.25 1.8.28 1.9.7 1.10.23 1.10.26 1.10.27 1.11.16 1.11.31 1.12.3 1.12.4 1.12.12 1.13.3 1.13.9 1.13.22 1.13.27 1.13.35 1.14.12 1.14.15 1.14.18 1.15.10 1.16.3 1.16.4 1.16.13 1.16.19 1.17.4 1.17.9 1.17.10 1.17.11 1.17.13 1.17.17 1.17.21 1.17.25 1.17.26 1.18.12 1.18.23 1.18.24 1.18.30 1.18.31 1.18.38 1.18.61 1.18.67 1.18.74

</details>

<details><summary>Tamil: purports flagged "too short" (3)</summary>

1.2.37 1.18.30 1.18.39

</details>

