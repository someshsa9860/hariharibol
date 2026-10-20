# Gita wording audit — 2026-10-20

Why this was done: the first verse (1.1.1) read *tīrtha-kṣetra* ("place of pilgrimage") in Hindi, Marathi and others, where the Sanskrit says
**dharma-kṣetra** ("field of dharma"). The same kind of slip could sit anywhere in the 701 verses, so every verse was checked against the Sanskrit.

## Result

**71 edits applied to S3** — 69 places, in 41 chapter files — in `s3://sanatan-db/json/bhagavat-gita/<lang>/ch-<n>.json`.
Nothing else was touched: the database, the app, the offline export and the Bhagavatam are unchanged.

| Lang | Edits | Chapter files written |
|---|---|---|
| hi | 13 | 7 |
| mr | 15 | 7 |
| bn | 12 | 8 |
| ta | 20 | 13 |
| te | 3 | 2 |
| kn | 5 | 2 |
| ml | 3 | 2 |

Group translations (29 groups, 71 verses that share one translation text) are written once per verse of the group, so a group edit shows as several places.

### The cause

The translator pipeline gave the model only Prabhupāda's English, never the Sanskrit. Where his English glosses a term as a different thing than the
Sanskrit word means — *dharma-kṣetre* → "place of pilgrimage" — all seven languages copied his gloss. 1.1.1's **purport** already used the right term
in all seven languages; only the translation and the word list were wrong. The fix restores the Sanskrit's word; Prabhupāda's English is unchanged.

### What was checked, and how

1. **Named terms** (`terms.mjs` → `runs/terms.jsonl`, 659 rows): Sanskrit terms against how each language renders them. Hand-written patches in
   `patches/term-fixes.json` (21 edits): dharma-kṣetre in 1.1.1 for all seven languages, dveṣau in 1.3.34 for hi / bn / te / kn / ml, and Kannada wording.
2. **Proofreading pass** (`review.mjs` → `runs/full.jsonl`): each verse (or verse group) was given to Claude with the Sanskrit, the word list with Prabhupāda's
   English beside the language's own, the English translation and the language's translation. It flagged 358 possible errors.
3. **Second look** (`verify.mjs --provider openai` → `runs/verified-luna.jsonl`): the 318 flagged units went to a second model with a stricter rubric; 123 edits got "apply".
4. **A person read each one in context** (`show.mjs`, `ctx.mjs`). Only **50 of the 123** were accepted — they are in `patches/accepted.json`, and
   `build-patches.mjs` turns only those into patches. The second model was not trusted on its own: it proposed wrong edits (changing *mām* to the accusative
   where the possessive is idiomatic, deleting a word-list entry, dropping a doubled pair).
5. **Applied** with `backend/scripts/fix-translation-script.js`: dry run on a scratch copy → apply to the scratch copy → second pass shows 0 changes → dry run
   on S3 (identical counts) → apply → live files read back, second dry run on S3 = 0 changes.

The rule for accepting an edit: the current text is **wrong** — ungrammatical, misspelt, names the wrong person, or a word-list gloss contradicts the same verse's
translation and the Sanskrit supports the change. Style, register, rewording and anything that merely follows Prabhupāda's English were rejected. When in doubt, reject.

## Backups and how to undo

Every changed file was copied first to `s3://sanatan-db/json-backup-2026-10-20/json/bhagavat-gita/<lang>/ch-<n>.json` (41 files). All 41 were compared with the
original snapshot and are identical to it. To undo a language, copy its files back, e.g.
`aws s3 cp s3://sanatan-db/json-backup-2026-10-20/json/bhagavat-gita/hi/ch-1.json s3://sanatan-db/json/bhagavat-gita/hi/ch-1.json --region ap-south-1`.
(`json-backup-2026-10-20-before-kn-sb-fixes/` is a different job's backup — the Bhagavatam Kannada work — and was not touched.)

The tool also stamps `aiTranslation.scriptFix` on each file it writes and may reorder the `warnings` lines of a verse; the scores did not change.

## What still has to happen for readers to see it

These are S3-only changes. Nothing reads them until they are brought in:

1. **Database:** admin panel → **Translations → Import** for each of the seven languages (replaces rows in place, ids kept). Local first, then production.
2. **Offline books:** the weekly export that phones sync from must run again (see "Book cache" in `backend/README.md`), or phones keep the old Gita until it does.
3. **Website / app caches:** nothing extra.

## Coverage — what was NOT checked

| Language | Verses reviewed by the proofreading pass |
|---|---|
| hi, mr, bn | all 701 |
| ta | 613 of 701 — chapter 17 has 18 of 28 verses, chapter 18 none |
| te, kn, ml | **none** — only the hand-written term fixes (21 edits) reach them |

The proofreading pass stopped because the Anthropic account ran out of credit (the run ended cleanly at 2,715 of 4,906 units; nothing was half-written).
**Purports were not reviewed in any language**, and transliteration was looked at only by the tool's own rules.
To finish, top up the Anthropic credit and run the same command again — it skips units already done:

```
cd backend/scripts/translation-audit-2026-10-20/gita-wording
node review.mjs --from <local copy of json/bhagavat-gita> --langs ta,te,kn,ml --out runs/full.jsonl
```

then `verify.mjs`, read the result in context, list the approved edits in `patches/accepted.json`, run `build-patches.mjs`, and apply the same way.
(A local copy is made with `aws s3 sync s3://sanatan-db/json/bhagavat-gita/ <dir>/` — it needs `en/` and `sa/` beside the languages.)

## Not fixed on purpose

These look odd but are Prabhupāda's own wording or a doctrinal choice, so they were left alone. Change them only if the project decides to.

- 1.10.26 *aśvattha* = "banyan"; 1.12.17 *dveṣṭi* = "grieves"; 1.18.13 *sāṅkhye* = "Vedānta"; 1.8.26 *śāśvate*; 1.15.13 *gām*; 1.11.39 *varuṇaḥ*.
- 1.1.43 *jāti / kula-dharma*; glosses of *buddhi*, *karma-yoga*, *daiva*, *guṇa*, *deva*; *śreyaḥ* = "benediction"; *makara* = मगर (shark); "Supreme" against *Paramātmā*.
- *mām* rendered as मेरी / माझी (an idiom of Hindi and Marathi, not a case error); "real four-armed form"; tense or register changes; variant spellings.

## Limits

- **No native speaker has read any of this.** The seven translations were made by models, and every new word in this audit was chosen by a model and then checked
  against the Sanskrit and the English in context, not by a native reader of each language. Treat it as a correction of clear errors, not a sign-off; a native
  reader per language is still the open item.
- The check catches a term that names the wrong thing, and clear grammar and spelling errors. It would not catch a sentence that is grammatical but subtly off.

## Cost

About **$8.2** in all: the proofreading pass $6.28, term check $0.86, three pilots on chapter 1 $0.92, a test run $0.02, and about $0.12 on OpenAI
(`gpt-6-luna`) for the second look and its calibration.

## Files here

| File | What |
|---|---|
| `terms.mjs`, `review.mjs`, `verify.mjs` | the checks (read-only; they write to `runs/`) |
| `units.mjs` | how a verse or verse group becomes a prompt, and the check that an edit fits |
| `build-patches.mjs` | turns the approved edits into a patch file |
| `show.mjs`, `ctx.mjs` | print an edit or a verse with its Sanskrit, English and the language's text, for reading in context |
| `patches/term-fixes.json` | 21 hand-written patches |
| `patches/accepted.json` | the 50 approved proofreading edits |
| `patches/review-fixes.json` | those, as patches (generated) |
| `patches/all-fixes.json` | the 71 patches that were applied (generated: term-fixes + review-fixes) |
| `runs/` | the model outputs, one line per unit |

Applying a patch file: `cd backend && node scripts/fix-translation-script.js --langs <l,..> --patches <file> [--apply]` (dry run by default; a patch
whose `find` is not found exactly once is refused). The patches are safe to run again — a second run finds them "already in place".
For the Anthropic-translated Gita only; **never run it on the Bhagavatam**.

## The edits

Each edit is shown as it was written: *Was* is the text that was replaced, *Now* the text that replaces it.

### Named-term fixes (hand-written) (21 edits, 21 places written)

| Lang | Verse(s) | Part | Was | Now | Why |
|---|---|---|---|---|---|
| hi | 1.1.1 | translation | तीर्थस्थल कुरुक्षेत्र में | धर्मक्षेत्र कुरुक्षेत्र में | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| hi | 1.1.1 | word 1 | तीर्थस्थल में | धर्मक्षेत्र में | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| hi | 1.3.34 | word 3 | तथा विरक्ति भी | तथा द्वेष भी | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment |
| mr | 1.1.1 | translation | कुरुक्षेत्र या तीर्थस्थानी | धर्मक्षेत्र कुरुक्षेत्र येथे | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| mr | 1.1.1 | word 1 | तीर्थस्थानी | धर्मक्षेत्री | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| bn | 1.1.1 | translation | কুরুক্ষেত্রের তীর্থক্ষেত্রে | ধর্মক্ষেত্র কুরুক্ষেত্রে | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| bn | 1.1.1 | word 1 | তীর্থক্ষেত্রে | ধর্মক্ষেত্রে | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| bn | 1.3.34 | word 3 | এবং অনাসক্তিও | এবং বিদ্বেষও | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment |
| ta | 1.1.1 | translation | குருக்ஷேத்திரம் என்னும் புனித யாத்திரைத் தலத்தில் | தர்மக்ஷேத்திரமான குருக்ஷேத்திரத்தில் | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| ta | 1.1.1 | word 1 | புனித யாத்திரைத் தலத்தில் | தர்மக்ஷேத்திரத்தில் | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| te | 1.1.1 | translation | కురుక్షేత్రమనే పుణ్యక్షేత్రంలో | ధర్మక్షేత్రమైన కురుక్షేత్రంలో | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| te | 1.1.1 | word 1 | పుణ్యక్షేత్రంలో | ధర్మక్షేత్రంలో | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| te | 1.3.34 | word 3 | ద్వేషం (విరక్తి) | ద్వేషం | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment |
| kn | 1.1.1 | translation | ಕುರುಕ್ಷೇತ್ರದ ತೀರ್ಥಕ್ಷೇತ್ರದಲ್ಲಿ | ಧರ್ಮಕ್ಷೇತ್ರ ಕುರುಕ್ಷೇತ್ರದಲ್ಲಿ | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| kn | 1.1.1 | word 1 | ತೀರ್ಥಕ್ಷೇತ್ರದಲ್ಲಿ | ಧರ್ಮಕ್ಷೇತ್ರದಲ್ಲಿ | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| kn | 1.3.34 | word 3 | ಹಾಗೂ ವಿರಕ್ತಿ | ಹಾಗೂ ದ್ವೇಷ | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment |
| kn | 1.3.34 | translation | ಆಸಕ್ತಿ ಮತ್ತು ವಿರಕ್ತಿಯನ್ನು | ಆಸಕ್ತಿ ಮತ್ತು ದ್ವೇಷವನ್ನು | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment (detachment = vairāgya, not dveṣa) |
| kn | 1.3.34 | translation | ಆಸಕ್ತಿ ಮತ್ತು ವಿರಕ್ತಿಗಳ ವಶಕ್ಕೆ | ಆಸಕ್ತಿ ಮತ್ತು ದ್ವೇಷಗಳ ವಶಕ್ಕೆ | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment |
| ml | 1.1.1 | translation | തീർത്ഥസ്ഥാനമായ കുരുക്ഷേത്രത്തിൽ | ധർമ്മക്ഷേത്രമായ കുരുക്ഷേത്രത്തിൽ | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| ml | 1.1.1 | word 1 | തീർത്ഥാടനസ്ഥലത്ത് | ധർമ്മക്ഷേത്രത്തിൽ | dharma-kṣetre means the field of dharma; the text followed the English gloss "place of pilgrimage" (tīrtha) |
| ml | 1.3.34 | word 3 | വിരക്തിയും | ദ്വേഷവും | dveṣau is aversion/hatred (the verse translation says so); the word list said detachment |

### Proofreading fixes (reviewed, then read in context) (50 edits, 50 places written)

| Lang | Verse(s) | Part | Was | Now | Why |
|---|---|---|---|---|---|
| hi | 1.2.48 | translation | सफलता या विफलता की सभी आसक्ति त्यागकर | सफलता या विफलता की सारी आसक्ति त्यागकर | grammar: 'सभी आसक्ति' is an agreement error: 'सभी' (plural) does not agree with the singular feminine 'आसक्ति'; 'सारी आसक्ति' is correct. |
| hi | 1.2.64 | word 1 | तथा विरक्ति | तथा द्वेष | wrong: English 'and detachment' for dveṣa; Hindi 'virakti' (detachment/dispassion) is a positive quality, not aversion, and contradicts the translation which says 'द्वेष'. |
| hi | 1.3.22 | word 9 | चाहा हुआ | अभाव | wrong: anavāptam means 'not obtained/unattained'; the Hindi 'चाहा हुआ' (desired) loses the negation of the English gloss 'wanted' sense of want/lack. |
| hi | 1.5.8 | word 13 | स्वप्न देखते हुए | सोते हुए | wrong: svapan means 'sleeping' (Prabhupāda's translation says sleeping), not 'dreaming'; the Hindi 'स्वप्न देखते हुए' gives the wrong sense and mismatches the Hindi translation's 'सोते'. |
| hi | 1.13.6 | word 0 | महान तत्त्व | महाभूत | term: mahā-bhūtāni means the great elements (mahābhūta), not 'great principle' (महान तत्त्व), which names a different thing (mahat-tattva). |
| hi | 1.17.5 | translation | उन्हें अभिमान और अहंकार से प्रेरित होकर करते हैं | वे अभिमान और अहंकार से प्रेरित होकर ऐसा करते हैं | grammar: Prabhupāda's English says "performing them out of pride and egoism"; the Hindi has the awkward, ungrammatical "उन्हें ... करते हैं" with a stray object pronoun, which is not good Hindi. |
| hi | 1.17.23 | translation | परम परम सत्य | परम सत्य | grammar: Duplicated word 'परम परम'; English says 'Supreme Absolute Truth' (परम सत्य). |
| hi | 1.18.1 | word 1 | त्याग का | संन्यास का | wrong: sannyāsa is renunciation as the renounced order (sannyāsa), not tyāga; Hindi duplicates tyāga for both words. |
| hi | 1.18.7 | translation | ऐसे त्याग को तमोगुण में कहा गया है | ऐसे त्याग को तमोगुणी कहा गया है | grammar: 'ऐसे त्याग को तमोगुण में कहा गया है' is ungrammatical; the renunciation is 'said to be in the mode of ignorance' → 'तमोगुणी कहा गया है'. |
| hi | 1.18.76 | word 3 | संदेश | संवाद | term: saṁvāda means dialogue/conversation, not 'message'; the English gloss 'message' misses the sense and the translation itself says dialogue (संवाद). |
| mr | 1.2.30 | translation | म्हणून तू कोणत्याही जीवासाठी | म्हणून तुला कोणत्याही जीवासाठी | grammar: Subject 'you' (तू) does not agree with the impersonal predicate 'आवश्यकता नाही'; the sentence is ungrammatical Marathi — should be 'तुला ... आवश्यकता नाही'. |
| mr | 1.2.49 | word 5 | हे धनाचा विजेत्या | हे धनाच्या विजेत्या | grammar: Dhanañjaya means 'conqueror of wealth' (धनाचा जिंकणारा/विजेता); the vocative 'हे धनाचा विजेत्या' is ungrammatical, needing the genitive-less form 'धनविजेत्या'. |
| mr | 1.2.64 | word 1 | आणि अनासक्ती | आणि द्वेष | wrong: dveṣa means aversion/hatred, not 'detachment'; the Marathi 'अनासक्ती' (non-attachment) mistranslates it and contradicts the translation's 'द्वेष'. |
| mr | 1.3.17 | word 3 | स्वयंप्रकाशित | आत्म्यात तृप्त | term: ātma-tṛptaḥ means satisfied/content in the Self, not 'self-illuminated' (स्वयंप्रकाशित); the Marathi follows the English gloss, but it names a different quality than tṛpta. |
| mr | 1.3.43 | translation | अध्यात्मिक | आध्यात्मिक | grammar: Spelling inconsistency: 'अध्यात्मिक' should be 'आध्यात्मिक' as used later in the same sentence. |
| mr | 1.4.33 | translation | हे पार्थपुत्रा | हे पृथापुत्रा | wrong: pārtha means son of Pṛthā (पृथापुत्र); 'पार्थपुत्रा' would mean son of Pārtha (Arjuna's son), a wrong relation. |
| mr | 1.9.9 | translation | हे सर्व कर्म मला | ही सर्व कर्मे मला | grammar: Number agreement: 'हे सर्व कर्म' (singular demonstrative) does not agree with plural verb 'बांधू शकत नाहीत'; should be plural 'ही सर्व कर्मे'. |
| mr | 1.9.9 | word 6 | हे धनाचा विजेत्या | हे धनाच्या विजेत्या | grammar: Dhanañjaya means 'conqueror of wealth'; 'धनाचा विजेत्या' is ungrammatical vocative form; should be 'धनाच्या विजेत्या'. |
| mr | 1.13.4 | word 6 | ज्यापासून | ज्याचे | wrong: yat (having what, in 'yad-vikāri') is rendered 'ज्यापासून' (from which), which wrongly duplicates yataḥ; it should be 'ज्याचे' / 'कोणते'. |
| mr | 1.18.1 | word 1 | त्यागाचा | संन्यासाचा | term: sannyāsasya means 'of renunciation (sannyāsa)', but the Marathi 'त्यागाचा' is identical to the gloss for tyāgasya, giving two identical entries; it should name sannyāsa. |
| mr | 1.18.7 | translation | नियत कर्तव्य कधीही | नियत कर्तव्ये कधीही | grammar: Plural subject 'कर्तव्ये' (and plural 'सोडू नयेत') requires the plural; singular 'नियत कर्तव्य' is a number agreement error with 'सोडू नयेत'. |
| mr | 1.18.76 | word 3 | संदेश | संवाद | wrong: saṁvādam means dialogue/conversation (English translation says 'dialogue'), not 'message' (संदेश). |
| mr | 1.18.78 | translation | सर्व योग्यांचे स्वामी | सर्व योगींचे स्वामी | wrong: The English says 'master of all mystics' (yogīs/mystics); 'योग्यांचे' is a wrong word (means 'suitable/worthy ones'), the correct word is 'योग्यांचे' → 'योगींचे'. |
| bn | 1.1.4 | translation | ভীম ও অর্জুনের সমকক্ষ বহু বীর ধনুর্ধর রয়েছেন, তাঁরা যুদ্ধে ভীম ও অর্জুনের সমান: | যুদ্ধে ভীম ও অর্জুনের সমান বহু বীর ধনুর্ধর রয়েছেন: | wrong: The English says 'many heroic bowmen equal in fighting to Bhīma and Arjuna: great fighters like...'; the Bengali repeats 'equal to Bhīma and Arjuna' twice, which is redundant and not in the English. |
| bn | 1.1.26 | word 4 | পিতৃব্যগণ | পিতাগণ | wrong: pitṝn means 'fathers' (pitā), but পিতৃব্যগণ means paternal uncles, a different relation. |
| bn | 1.1.26 | translation | পিতৃব্যগণ | পিতাগণ | wrong: English says 'his fathers', but পিতৃব্যগণ means paternal uncles, not fathers. |
| bn | 1.2.64 | word 1 | এবং অনাসক্তি | এবং বিদ্বেষ | term: dveṣa means aversion/hatred, not 'detachment' (anāsakti); the Bengali follows a misleading gloss and names a different concept. |
| bn | 1.5.27 | word 3 | অনাবশ্যক | বাহ্য | term: bāhyān means 'external', but the Bengali 'অনাবশ্যক' (unnecessary) gives a wrong sense (the English gloss 'unnecessary' is itself a misrendering); it should be 'বাহ্য'. |
| bn | 1.13.4 | word 20 | বোঝো | শোনো | wrong: śṛṇu means 'hear/listen' (translation says 'hear'); 'বোঝো' (understand) is not what the verb means and mismatches the Bengali translation's 'শোনো'. |
| bn | 1.14.23 | translation | বন্ধু ও শত্রুকে সমান আচরণ করেন | বন্ধু ও শত্রুর প্রতি সমান আচরণ করেন | grammar: Verb 'আচরণ করেন' needs the object marked as 'to' (treats friend and enemy alike); 'বন্ধু ও শত্রুকে সমান আচরণ' is ungrammatical Bengali. |
| bn | 1.17.26 | translation | হে পার্থপুত্র | হে পৃথাপুত্র | wrong: English says 'O son of Pṛthā' (pārtha = Arjuna, son of Pṛthā); 'পার্থপুত্র' would mean son of Pārtha, which is wrong. |
| bn | 1.18.76 | word 3 | বার্তা | কথোপকথন | wrong: saṁvādam means dialogue/conversation, not 'message' (বার্তা); the translation itself says কথোপকথন. |
| ta | 1.1.35 | translation | மூவுலகங்களையும் பரிமாறாகக் கொடுத்தாலும் | மூவுலகங்களுக்குப் பதிலாகவும் | grammar: 'in exchange for the three worlds' is rendered with a non-word 'பரிமாறாகக்'; the correct word is 'பதிலாக' (in exchange). |
| ta | 1.2.64 | word 1 | மற்றும் பற்றின்மை | மற்றும் வெறுப்பு | term: dveṣa means aversion/hatred, not detachment; the Tamil 'பற்றின்மை' (non-attachment) names the opposite of what dveṣa is, and it clashes with the translation's 'வெறுப்பு'. |
| ta | 1.3.13 | translation | தனிப்பட்ட புலனின்பத்திற்காக உணவைத் தயாரிப்பவர்கள், மற்றவர்கள், உண்மையில் | தனிப்பட்ட புலனின்பத்திற்காக உணவைத் தயாரிக்கும் மற்றவர்கள், உண்மையில் | grammar: Word order is awkward: 'Others, who prepare food...' should read 'Others, who prepare...'; the Tamil places 'மற்றவர்கள்' after the relative clause, which is broken grammar. |
| ta | 1.5.22 | translation | ஓர் தொடக்கமும் | ஒரு தொடக்கமும் | grammar: Grammar: 'ஓர்' is used only before vowel-initial words; before 'தொடக்கமும்' (consonant) it must be 'ஒரு'. |
| ta | 1.6.33 | word 2 | மாயாவாதம் | யோகம் | term: yogaḥ means yoga (the English gloss 'mysticism'), but the Tamil says 'māyāvādam' (Māyāvāda philosophy), a different thing. |
| ta | 1.6.36 | word 10 | முயற்சி செய்போது | முயற்சி செய்யும்போது | grammar: Spelling error: 'செய்போது' is not valid Tamil; it should be 'செய்யும்போது' (while endeavoring). |
| ta | 1.7.14 | translation | ஆன இந்த தெய்வீக சக்தியை | ஆன என்னுடைய இந்த தெய்வீக சக்தியை | wrong: The English says 'This divine energy of Mine'; the Tamil omits 'Mine' (mama), dropping the possessive and leaving the energy unattributed to the Lord. |
| ta | 1.9.9 | word 6 | செல்வத்தைக் வென்றவனே | செல்வத்தை வென்றவனே | grammar: Spelling/grammar error: 'செல்வத்தைக் வென்றவனே' has an incorrect sandhi (க் before வ); should be 'செல்வத்தை வென்றவனே' (dhanam-jaya). |
| ta | 1.9.22 | translation | தனிப்பட்ட பக்தியுடன் | வேறு எதிலும் நாட்டமில்லாத பக்தியுடன் | wrong: Prabhupāda's 'exclusive devotion' (ananyāḥ) means undivided devotion, but 'தனிப்பட்ட' means 'personal/private', which gives a wrong sense. |
| ta | 1.10.11 | translation | சிறப்பு கருணை | சிறப்புக் கருணை | grammar: Grammar: 'சிறப்பு கருணை' is an ungrammatical compound; it should be 'சிறப்புக் கருணை' with the doubling consonant (as in the word list). |
| ta | 1.12.6 | translation | பார்த்தனின் மகனே | பிருதையின் மகனே | wrong: 'O son of Pṛthā' is Pārtha, a vocative addressing Arjuna; 'பார்த்தனின் மகனே' wrongly calls him son of Pārtha, making him the son of Arjuna. |
| ta | 1.12.18 | translation | மகிழ்ச்சி மற்றும் துயரம் ஆகியவற்றில் சமநிலையில் இருப்பவரும் | மகிழ்ச்சி மற்றும் துயரம், புகழ் மற்றும் இகழ்ச்சி ஆகியவற்றில் சமநிலையில் இருப்பவரும் | wrong: The English says 'fame and infamy' but the Tamil omits this pair entirely, dropping a meaning. |
| ta | 1.13.10 | translation | புலனடக்கப் பொருட்களைத் துறத்தல் | புலனின்பப் பொருட்களைத் துறத்தல் | wrong: 'Renunciation of the objects of sense gratification' is rendered as renouncing 'sense-control objects' (புலனடக்கப் பொருட்கள்), which names a different thing than the objects of sense gratification. |
| ta | 1.14.18 | translation | நரக உலகங்களுக்குக் கீழே செல்கிறார்கள் | நரக உலகங்களுக்குச் செல்கிறார்கள் | wrong: English says 'go down to the hellish worlds', but the Tamil says 'go below the hellish worlds', changing the sense. |
| ta | 1.15.7 | translation | இந்தப் பக்குவமற்ற உலகில் | இந்தக் கட்டுண்ட உலகில் | wrong: English says 'conditioned' (baddha), but Tamil 'பக்குவமற்ற' means 'immature/unripe', which is a wrong sense; the word list correctly uses 'கட்டுப்பட்ட'. |
| ta | 1.15.7 | translation | பக்குவமற்ற வாழ்வின் காரணமாக | கட்டுண்ட வாழ்வின் காரணமாக | wrong: 'conditioned life' rendered as 'பக்குவமற்ற வாழ்வு' (immature life) instead of conditioned life. |
| ta | 1.17.1 | word 14 | உணர்ச்சியில் | ரஜோ குணத்தில் | term: rajaḥ is the guṇa of passion (rajo-guṇa); 'உணர்ச்சி' means emotion/feeling and does not name the same thing, so the Tamil should use the standard term 'ரஜோ/இராஜஸ' or 'ஆசை/இச்சை' (passion). |
| ta | 1.17.1 | translation | உணர்ச்சியில் இருக்கிறார்களா | ரஜோ குணத்தில் இருக்கிறார்களா | term: 'in passion' (rajaḥ) is rendered 'உணர்ச்சியில்' (emotion), which does not name the mode of passion; use rajo-guṇa. |
