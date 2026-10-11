# The app's words

Every word the app shows is in an ARB file here. `app_en.arb` is the template; each of the
eleven other files is one language, and the names are the language codes the backend uses.

| File | Language | | File | Language |
|---|---|---|---|---|
| `app_en.arb` | English (template) | | `app_or.arb` | Odia |
| `app_hi.arb` | Hindi | | `app_pa.arb` | Punjabi |
| `app_mr.arb` | Marathi | | `app_ml.arb` | Malayalam |
| `app_gu.arb` | Gujarati | | `app_as.arb` | Assamese |
| `app_bn.arb` | Bengali | | `app_ta.arb` | Tamil |
| `app_te.arb` | Telugu | | `app_kn.arb` | Kannada |

Sanskrit is a mantra and reading language, not a UI language, so it has no file.
`generated/` is written by `tool/flutter.sh gen-l10n` and is committed.

## The rule

**Whatever is added to `app_en.arb` is translated into every other `app_*.arb` in the same change.**

`flutter gen-l10n` only prints a warning for a missing translation, and the app then shows
English without a sound. So `test/l10n_parity_test.dart` makes the rule fail loudly. It reads
the files in this folder, so a language added tomorrow is checked tomorrow, and it fails on:

- a key in `app_en.arb` that a language lacks, or a key a language has that English does not
- a placeholder (`{name}`, `{count, plural, …}`) that the English text uses and the translation drops
- a message still identical to the English one
- a digit that is not 0–9
- `@key` metadata in a translation, or a missing or wrong `@@locale`
- a language that has no entry in `ios/Runner/Info.plist` (`CFBundleLocalizations`), or that the
  generated code does not know (you forgot `gen-l10n`)
- a language Flutter's own Material, Widgets or Cupertino strings, or the date formats, cannot serve

What no test can see is **English that changes meaning under the same key**. Reword a text and
the keys still match. If the meaning changes, translate it again in every file in the same
change, or give it a new key so the test sees it. A typo fix is not that.

## Add a string

1. `app_en.arb`: the key, its text, and its `@key` block (a `description`, and a `placeholders`
   entry with a `type` for each `{placeholder}`). Name it `<screen><What>`, like its neighbours.
2. Each of the other eleven files: the same key with the translation, in the **same position**
   as in English. A translation file has no `@key` blocks.
3. `tool/flutter.sh gen-l10n`
4. `tool/flutter.sh test test/l10n_parity_test.dart`

## Add a language

1. Create `app_xx.arb`: `@@locale` first, then every key of `app_en.arb` in the same order.
2. `tool/flutter.sh gen-l10n`, and commit `generated/`.
3. Add `xx` to `CFBundleLocalizations` in `ios/Runner/Info.plist`.
4. In the admin panel's Reference data, make sure the language has **App** on. The picker lists
   what the backend says; the interface only switches to a language that has a file.

The test checks steps 1–3.

## House style

- **Keep the placeholders and the ICU shape.** Translate the words inside a `plural` or `select`
  branch, not the keywords. Plurals are written `=0` / `=1` / `other` in every language, and
  every language here needs no more than that.
- **Latin digits, 0–9, everywhere.** `gen-l10n` writes `{count}` that way, so a translation with
  ४ or ৪ in it would show both kinds side by side. Dates are the exception the test does not
  police: they are written by `intl` in the reader's locale.
- **Brand names and codes stay Latin:** `HariHariBol`, `BG`, `SB` (and `BG 2.47`), Google, Apple,
  Wi-Fi, MB, AI.
- **Do not glue an ending onto a placeholder** that holds a name, an email or a date; a name cannot
  be declined safely. Put it after a colon, or in a separate word. A number may take a following
  word (`{number} নং …`).
- **Sentence-final mark follows the script.** The danda `।` is used in Hindi, Bengali, Odia,
  Punjabi and Assamese; a full stop `.` in Marathi, Gujarati, Tamil, Telugu, Kannada and Malayalam.
- **Assamese is not Bengali.** It has its own ৰ (U+09F0) and ৱ (U+09F1); Bengali র (U+09B0) must
  not appear. A creator is `ক্ৰিয়েটৰ`, never `সৃষ্টিকৰ্তা` (that word means God).
- **Devotional terms are fixed, below.** Use the same word for the same thing on every screen.

## Words that must stay the same everywhere

| | verse | canto | chapter | mala (round) | chant | purport | meaning | word meanings | practice (sādhana) | Hari Bol |
|---|---|---|---|---|---|---|---|---|---|---|
| English | Verse | Canto | Chapter | Mala | Japa | Purport | Meaning | Word meanings | Practice | Hari Bol |
| Hindi | श्लोक | स्कंध | अध्याय | माला | जप | तात्पर्य | अर्थ | शब्दार्थ | साधना | हरि बोल |
| Marathi | श्लोक | स्कंध | अध्याय | माळा | जप | तात्पर्य | अर्थ | शब्दार्थ | साधना | हरी बोल |
| Gujarati | શ્લોક | સ્કંધ | અધ્યાય | માળા | જપ | તાત્પર્ય | અર્થ | શબ્દાર્થ | સાધના | હરિ બોલ |
| Bengali | শ্লোক | স্কন্ধ | অধ্যায় | মালা | জপ | তাৎপর্য | অর্থ | শব্দার্থ | সাধনা | হরি বোল |
| Tamil | ஸ்லோகம் | ஸ்கந்தம் | அத்தியாயம் | மாலா | ஜபம் | பொருளுரை | பொருள் | சொற்பொருள் | சாதனா | ஹரி போல் |
| Telugu | శ్లోకం | స్కంధం | అధ్యాయం | మాల | జపం | భాష్యం | అర్థం | పదార్థాలు | సాధన | హరి బోల్ |
| Kannada | ಶ್ಲೋಕ | ಸ್ಕಂಧ | ಅಧ್ಯಾಯ | ಮಾಲೆ | ಜಪ | ತಾತ್ಪರ್ಯ | ಅರ್ಥ | ಪದಾರ್ಥ | ಸಾಧನೆ | ಹರಿ ಬೋಲ್ |
| Odia | ଶ୍ଳୋକ | ସ୍କନ୍ଧ | ଅଧ୍ୟାୟ | ମାଳା | ଜପ | ତାତ୍ପର୍ଯ୍ୟ | ଅର୍ଥ | ଶବ୍ଦାର୍ଥ | ସାଧନା | ହରି ବୋଲ |
| Punjabi | ਸ਼ਲੋਕ | ਸਕੰਧ | ਅਧਿਆਇ | ਮਾਲਾ | ਜਪ | ਤਾਤਪਰਯ | ਅਰਥ | ਸ਼ਬਦਾਰਥ | ਸਾਧਨਾ | ਹਰਿ ਬੋਲ |
| Malayalam | ശ്ലോകം | സ്കന്ധം | അധ്യായം | മാല | ജപം | ഭാവാർത്ഥം | അർത്ഥം | വാക്കുകളുടെ അർത്ഥം | സാധന | ഹരി ബോൾ |
| Assamese | শ্লোক | স্কন্ধ | অধ্যায় | মালা | জপ | তাৎপৰ্য | অৰ্থ | শব্দাৰ্থ | সাধনা | হৰি বোল |

Where a language has a plural it is the usual plural of these (Tamil `மாலாக்கள்`, Telugu `మాలలు`,
Kannada `ಮಾಲೆಗಳು`, Malayalam `മാലകൾ`, Punjabi `ਮਾਲਾਵਾਂ`).

## Review status

**The eleven translations were drafted by Claude, an AI, in October 2026. No native speaker has
reviewed them.** Read the devotional terms above and the Assamese file first, then the rest of the
screens a new reader meets: sign-in, the dashboard, the chant counter and the reading page.
The same is true of the seeded mantras' names, meanings and purports in
`backend/prisma/seed/mantra-translations/`. In the app, start with the four mantra categories
(`mantraCategory*`): "Beej" and "Name" are written as the full term (*bīja mantra*, *nāma mantra*)
because the bare word means "seed" or "name" in everyday speech, and in Tamil, Telugu and Kannada
*nāmam* alone is also slang for being cheated.
Delete this section when the reviews are done.
