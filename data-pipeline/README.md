# HariHariBol Data Pipeline

Scripts to fetch, parse, and upload Vedic text data to S3.

## Prerequisites

```bash
npm install aws-sdk
```

Environment variables required:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET` (e.g. `sanatan-db`)
- `S3_REGION` (e.g. `ap-south-1`)

## Jobs

### Job 1 — Bhagavat Gita Sanskrit source

```bash
node job1-bg-sanskrit.js
```

- Source: [vedicscriptures/bhagavad-gita](https://github.com/vedicscriptures/bhagavad-gita) (GPL-3.0)
- Output: `s3://BUCKET/json/bhagavat-gita/sa/ch-{1..18}.json`
- Content: All 700 BG verses with Sanskrit, transliteration, and devotional commentaries
- Commentators: Prabhupada, Sivananda, Ramsukhdas, Shankaracharya, Ramanujacharya, Madhavacharya, Vallabhacharya, Sridhara Swami

### Job 3 — Dnyaneshwari (Marathi poetic expansion)

```bash
node job3-dnyaneshwari.js
```

- Source: [cltk/marathi_text_wikisource](https://github.com/cltk/marathi_text_wikisource) (CC0)
- Output: `s3://BUCKET/json/dnyaneshwari/mr/ch-{1..18}.json`
- Content: ~9,142 ovis mapped to BG verses by chapter and verse number
- Type: `poetic_expansion` — each BG verse has an `oviStart`/`oviEnd` range

### Job 4 — Srimad Bhagavatam Cantos 1-9 (Prabhupada, English)

```bash
node job4-sb-en.js
```

- Source: [srimad-bhagavatam/srimad-bhagavatam.github.io](https://github.com/srimad-bhagavatam/srimad-bhagavatam.github.io) (Prabhupada 1977 edition)
- Output: `s3://BUCKET/json/srimad-bhagavatam/en/c{canto}-ch-{chapter}.json`
- Coverage: Cantos 1-9 (201 files, ~7,303 verses, 16.8 MB)
- Content: Roman transliteration, word synonyms, English translation + purport
- Translator: `prabhupada`
- `verseId` format: `2.{canto}.{chapter}.{verse}` (bookNumber=2 for SB)

### Job 4b — Srimad Bhagavatam Cantos 10-12 (vedabase.io, English)

```bash
node job4b-sb-cantos10-12.js
```

- Source: [vedabase.io](https://vedabase.io/en/library/sb/) (Prabhupada — Bhaktivedanta VedaBase)
- Output: `s3://BUCKET/json/srimad-bhagavatam/en/c{canto}-ch-{chapter}.json`
- Coverage: Cantos 10-12 (134 files, 5,296 verse entries)
  - Canto 10: 90 chapters, 3,572 verses
  - Canto 11: 31 chapters, 1,244 verses
  - Canto 12: 13 chapters, 480 verses
- Content: Devanagari, Roman transliteration, word synonyms, English translation + purport
- Translator: `prabhupada`
- `verseId` format: `2.{canto}.{chapter}.{verse}` or `2.{canto}.{chapter}.{start}-{end}` for compound verse entries
- Note: Uses 800 ms polite delay between requests; GitHub Actions timeout set to 120 min

## S3 Structure

```
json/
  bhagavat-gita/
    sa/                    ← Sanskrit + multi-translator commentaries (Job 1)
      ch-1.json ... ch-18.json
    hi/                    ← Hindi translations (Job 2)
    en/                    ← English translations (Job 2)
  srimad-bhagavatam/
    en/                    ← Prabhupada English (Jobs 4 + 4b) — 335 files total
      c1-ch-1.json ... c9-ch-24.json   (Job 4 — cantos 1-9)
      c10-ch-1.json ... c12-ch-13.json (Job 4b — cantos 10-12)
  dnyaneshwari/
    mr/                    ← Marathi poetic expansion (Job 3)
      ch-1.json ... ch-18.json
  reports/                 ← Job run reports with status and issues
```

## JSON Schema

### BG Sanskrit chapter (`sa/ch-N.json`)

```json
{
  "meta": {
    "bookNumber": 1,
    "bookSlug": "bhagavat-gita",
    "language": "sa",
    "chapterNumber": 2,
    "totalVerses": 72,
    "globalVerseStart": 48,
    "globalVerseEnd": 119
  },
  "verses": [{
    "verseId": "1.2.1",
    "globalVerseNumber": 48,
    "bookNumber": 1,
    "chapterNumber": 2,
    "verseNumber": 1,
    "sanskrit": "...",
    "transliteration": "...",
    "commentaries": [{
      "translatorSlug": "prabhupada",
      "type": "translation",
      "language": "en",
      "text": "..."
    }]
  }]
}
```

### SB chapter (`srimad-bhagavatam/en/cN-ch-M.json`)

```json
{
  "meta": {
    "bookNumber": 2,
    "bookSlug": "srimad-bhagavatam",
    "language": "en",
    "cantoNumber": 10,
    "chapterNumber": 1,
    "totalVerseEntries": 63,
    "translatorSlug": "prabhupada",
    "source": "vedabase.io (Prabhupada — Bhaktivedanta VedaBase)",
    "generatedAt": "..."
  },
  "verses": [{
    "verseId": "2.10.1.5-7",
    "bookNumber": 2,
    "cantoNumber": 10,
    "chapterNumber": 1,
    "verseNumber": 5,
    "verseNumberEnd": 7,
    "sanskrit": "...",
    "transliteration": "...",
    "wordMeanings": [{ "raw": "śrī-śukaḥ uvāca — ..." }],
    "commentaries": [
      { "translatorSlug": "prabhupada", "type": "translation", "language": "en", "text": "..." },
      { "translatorSlug": "prabhupada", "type": "purport", "language": "en", "text": "..." }
    ]
  }]
}
```

### Dnyaneshwari chapter (`dnyaneshwari/mr/ch-N.json`)

```json
{
  "meta": {
    "bookNumber": 1,
    "bookSlug": "bhagavat-gita",
    "sourceText": "dnyaneshwari",
    "translatorSlug": "dnyaneshwar",
    "commentaryType": "poetic_expansion",
    "language": "mr",
    "chapterNumber": 2,
    "totalOvis": 375,
    "totalGitaVerses": 67
  },
  "verseMappings": [{
    "verseId": "1.2.1",
    "bookNumber": 1,
    "chapterNumber": 2,
    "verseNumber": 1,
    "oviStart": 1,
    "oviEnd": 5,
    "ovis": [{
      "oviNumber": 1,
      "text": "मग संजयो म्हणे रायातें..."
    }]
  }]
}
```
