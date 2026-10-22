# Gita grouped verses — one translation per verse (2026-10-22)

**The bug.** The Gita has 31 groups (75 verses) that the official BBT text gives ONE translation and ONE purport
(e.g. 18.51-53). S3 copied the group's whole translation and purport onto every verse of the group, in English
and in hi mr bn ta te kn ml, so 18.51, 18.52 and 18.53 read the same.

**The fix (S3 only).** Each group's Prabhupāda translation was cut at clause breaks, one piece per verse, wording
unchanged; the purport stays once, on the LAST verse of the group, and the Prabhupāda purport row is deleted from
the earlier verses. Other translators' rows, word meanings and transliteration are untouched.
For each language one of the group's existing versions is used as the source (`plan.json`, chosen by how well its
clauses line up with the verses' word meanings; a version the 2026-10-20 wording audit patched is always preferred
so those fixes persist). Its `correctness` score, warnings and stamp move with the text; every changed verse's
`aiTranslation.sourceHash` / `parts[*].sourceHash` was recomputed for the new English, and `groupSplit` records the
date and the source verse.

**Applied** to 104 files (13 chapters x en + 7 languages). Originals: `s3://sanatan-db/json-backup-2026-10-22/json/bhagavat-gita/<lang>/ch-N.json`.

**Files.** `cuts.json` = English cut points (clause numbers or `{before}` anchors), `overrides.json` = per-language
version / cut choices where the automatic ones were wrong, `apply-report.json` = every segment written.
`lib.mjs` has the paths (`SP`) hard-coded to that session's scratchpad: point it at a folder holding the S3 download
as `orig/json/bhagavat-gita/<lang>/ch-N.json`, then `node plan.mjs && node apply.mjs && node validate.mjs && node diff.mjs`
(`apply.mjs` writes to `work/`, never to S3; `validate.mjs` runs the pipeline's own `verifyEntry`).

**Limits.** Cut points are an editorial call and nobody who reads these languages has checked them. Where a language
reorders the English sentence the in-order cut is approximate: mr 1.32; the first cut of bn/ta/kn/ml 1.32; te/kn 1.21
(verse 21 gets only "Arjuna said: O Achyuta,"); ta 2.42; hi 14.22 cuts mid-clause. The last sentence of 1.32-35 sits in
verse 35, as in the English.

**Not done.** The database and the offline book export still hold the old text: run admin Translations -> Import per
language (local, then prod), the English import, and a fresh book export.
