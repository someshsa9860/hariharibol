# Sakha Speech: plan (v3)

Status: **the project is created** in `sakha-speech/` (29 Oct 2026); no audio has been generated. See sakha-speech/CLAUDE.md for what has and has not run.
Decided so far (Somesh, 29 Oct 2026):
- Name **Sakha Speech**, a Python project in a new folder `sakha-speech/` of the hariharibol repo (main branch).
- Audio is **generated ahead of time**, uploaded to S3, and readers only play the MP3. Nothing runs on a reader's phone or browser.
- v1: **English and Hindi**, content **Bhagavad Gita verse meanings** (about 700 verses x 2 languages).
- Runs on **Somesh's Mac** at the start; a rented GPU only if the Mac is too slow.
- **Flexible voices**: any language, gender and model, set in config.
- **One narrator per book**: the same voice for the whole book in a language and gender.
- Written in this cloud session; must run on the Mac on its own, with no dependency on this session.

## 1. How it runs on the Mac
- One setup command: `./setup.sh`. It installs `uv` if missing, makes a Python 3.11 environment (uv downloads Python itself), installs the packages, and installs `ffmpeg` with Homebrew (espeak-ng, used by Kokoro's Hindi, comes bundled in a Python package).
- Python 3.11 on purpose: Kokoro pins `numpy==1.26.4` (no wheels for 3.13) and parler-tts pins `transformers==4.46.1`; 3.11 satisfies both in one environment.
- One-time Hugging Face login (`hf auth login`): AI4Bharat's Indic Parler-TTS model is gated, you accept its terms on the website once. Models (about 3.5 GB for Parler, 330 MB for Kokoro) download on first use and are cached.
- Runs on the Apple GPU (PyTorch MPS), falls back to CPU. Also works on Linux with an NVIDIA GPU, unchanged.
- Settings in `sakha-speech/.env` (gitignored): API base URL, AWS keys, bucket, region. Nothing secret committed.
- Works offline after the first model download, except fetching text and uploading.

## 2. Engines and starting voices
| Voice id | Language | Gender | Engine | Notes |
|---|---|---|---|---|
| `hi-parler-rohit` | hi | male | Indic Parler-TTS | recommended Hindi speaker on the model card |
| `hi-parler-divya` | hi | female | Indic Parler-TTS | recommended Hindi speaker |
| `hi-kokoro-omega` | hi | male | Kokoro | lighter, faster alternative |
| `hi-kokoro-alpha` | hi | female | Kokoro | lighter, faster alternative |
| `en-kokoro-michael` | en | male | Kokoro | American |
| `en-kokoro-heart` | en | female | Kokoro | American, Kokoro's best-rated voice |
| `en-kokoro-george` | en | male | Kokoro | British |
| `en-parler-thoma` / `en-parler-mary` | en | m / f | Indic Parler-TTS | Indian-English accent |

- Both engines Apache-2.0 (each voice's licence is recorded in `voices.yaml`).
- Parler voices are fixed by a speaker name, a written description ("speaks slowly and calmly, clear devotional tone, studio quality") and a seed, so every chunk of every verse sounds like the same person.
- The voice test (Phase 0) picks the narrators; the table is a starting list, not a choice.
- New engine later (IndicF5 voice cloning, AI4Bharat Indic-TTS for other languages) = one new file in `engines/` and lines in `voices.yaml`.

## 3. One narrator per book
`books.yaml` pins the narrator per language and gender:
```yaml
bhagavad-gita:
  bookNumber: 1
  kinds: [meaning]
  translator: null          # null = the first published TRANSLATION in that language
  narrators:
    en: { male: en-kokoro-michael, female: en-kokoro-heart }
    hi: { male: hi-parler-rohit,  female: hi-parler-divya }
```
- A run asks for book + language + gender, never a voice, so a book cannot be half one voice and half another.
- Changing a narrator means editing this file; the next run makes the whole book in the new voice (files are stored under the voice id, so the old set stays until deleted).

## 4. Where the text comes from
- The public website API, no login: `GET /api/web/content/sitemap` for the Gita's verse ids (prefix `1.`), then `GET /api/web/content/verses/<id>` for each verse's translations. Paced at 2 requests a second (the API allows 180 a minute) and **cached on disk**, so it is fetched once.
- Picks `type: TRANSLATION` in the language (skips Dnyaneshwari-style poetic expansions and purports).
- **Risk:** Hindi Gita rows imported from the Claude translation are hidden until published. If the API returns no Hindi meaning, the run says how many verses are missing; fallback is reading the saved files `json/bhagavat-gita/hi/ch-<n>.json` from S3 directly (`--source s3`).
- A third source, `--source file.json`, for anything else (mantras, etiquette, other books later).

## 5. The pipeline for one verse
1. **Normalise**: English diacritics to speakable spelling (Kṛṣṇa to Krishna, ś/ṣ to sh, ā to a) with a small pronunciation list per language (`lexicon/en.yaml`, `lexicon/hi.yaml`) for names the model gets wrong; verse numbers like "2.47" spoken properly.
2. **Split** into sentences (English . ? !, Hindi danda), long ones at commas; each engine says how long a piece it handles well.
3. **Synthesise** each piece with the fixed seed.
4. **Check**: speech length against text length and near-silence; a bad piece is retried with the next seed twice, then the verse is marked "check" for a person.
5. **Join** with natural pauses, trim silence, **loudness-normalise** (EBU R128, -16 LUFS) and encode **MP3 64 kbps mono** with ffmpeg.
6. **Save locally** first (`work/audio/...`) so you can listen before anything is uploaded.
7. **Hash** of text + voice settings + pipeline version is recorded; a re-run only makes changed or new verses. Stopping and restarting picks up where it left off.
Phase 2 adds a stronger check: speech recognition on the result compared with the text.

## 6. Commands
```
sakha-speech voices                          # list voices (language, gender, engine)
sakha-speech fetch    --book bhagavad-gita --lang en,hi
sakha-speech sample   --lang hi              # voice test: same sentences in every Hindi voice + a listening page
sakha-speech generate --book bhagavad-gita --lang hi --gender female [--chapter 2] [--limit 20]
sakha-speech review                          # local page: play verses marked "check", approve or redo
sakha-speech upload   --book bhagavad-gita --lang hi --gender female [--dry-run]
sakha-speech status   --book bhagavad-gita   # done / check / uploaded, per language and gender
```

## 7. S3 layout
```
narration/<book>/<lang>/<voice-id>/<chapter>/<verse>-meaning.mp3     (Gita)
narration/<book>/<lang>/<voice-id>/<canto>/<chapter>/<verse>-meaning.mp3
narration/<book>/<lang>/<voice-id>/_index.json   (voice, gender, model, and per verse: key, duration, text hash)
```
Same bucket as the recitations (`S3_BUCKET`, ap-south-1); a compound verse (16-18) is filed under its first number, like `utils/verse-audio.js`. `_index.json` lets the backend import the set later without guessing.

## 8. Folder layout
```
sakha-speech/
  CLAUDE.md  README.md  setup.sh  pyproject.toml  .env.example
  voices.yaml  books.yaml  lexicon/en.yaml  lexicon/hi.yaml
  sakha_speech/
    cli.py  config.py  content.py  text.py  audio.py  keys.py  manifest.py  s3.py  review.py
    engines/  base.py  parler.py  kokoro.py  fake.py (tests)
  tests/
  work/            (gitignored: cached text, audio, manifests, samples)
```
Flat and predictable, per the repo's "simple over clever" rule.

## 9. Phases
0. **Build the project + voice test.** Built and unit-tested here with a fake engine (the cloud session cannot download models, Hugging Face is blocked from it). Then run on your Mac: `setup.sh`, `sample --lang en` and `--lang hi`; you listen and pick the narrators. Run either by you, or by me through a Remote Control session you approve.
1. **Gita meanings, English and Hindi**: fetch, generate a chapter, listen, then all 18 chapters, then upload.
2. **Quality**: speech-recognition check, review page, pronunciation list grown from what you hear.
3. **Backend and app** (separate change): `VerseNarration` table filled from `_index.json`, `narrationUrl` in the reader API and offline export, the app plays it like a recitation, choosing by the reader's preferred gender.
4. **Later**: purports, Bhagavatam, the other 10 languages, a rented GPU for big runs, an admin page.

## 10. What is not known yet
- Speed on your Mac (Parler on MPS is the unknown; Kokoro is fast). Measured in Phase 0.
- Whether the Hindi Gita meanings are published on the live API (section 4).
- How well the voices say Sanskrit names; the pronunciation list and your ears decide.
- Licences and the gated model terms are to be read once before generating for the app.
