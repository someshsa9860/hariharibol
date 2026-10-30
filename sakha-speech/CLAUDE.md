# sakha-speech/ — narration generator (Python)

Makes narration MP3s ahead of time on the owner's Mac (or a GPU box) and uploads them to S3; readers
only play them. Read [README.md](README.md) for how it is used and [PLAN.md](PLAN.md) for why it is built this way.

## Rules

- **One voice per character, per book and language.** A book's cast is `characters/<book>.json` (its
  characters, and which one speaks each verse: the Sanskrit `speaker` field, or the English "X said" lead-in);
  the voice each character speaks with in each language is chosen in the studio and kept in
  `characters/<book>.voices.json`. A character with no voice chosen, and a book with no cast, use the
  narrators in `books.yaml` (one per language and gender). Never add a way to pick a voice per verse.
- **Voices are config, not code.** A new voice is an entry in `voices.yaml`; a new kind of model is one file
  in `sakha_speech/engines/` plus a branch in `engines/__init__.py`.
- **Commercial-safe licences only** in `voices.yaml` (HariHariBol has paid plans): no Coqui XTTS, Meta MMS
  or F5 base weights without the owner's decision. Each voice carries its `licence`.
- **Never make a verse twice for nothing.** The manifest hash covers spoken text + the voice *resolved* for the
  verse (its settings too) + `PIPELINE_VERSION` (`sakha_speech/__init__.py`); raise that only when every file
  should change. Choosing the voice a character already falls back to changes nothing; changing one character's
  voice makes only that character's verses new.
- **The folder is the S3 layout, and mirrors `backend/utils/verse-audio.js`**: `narration/<book>/<lang>/<canto>/<chapter>/<verse>.mp3`
  (compound verse under its first number; a purport is `<verse>-purport.mp3`), with **no voice in the path**.
  Change `keys.py` and that file together, or not at all. The language folder after the book is ours, not the
  backend's recitation layout.
- **A job is a separate process and may be killed at any moment.** The MP3 is written to `.part.mp3` and renamed;
  the manifest is saved only after the MP3 is complete; progress is `work/jobs/<id>/status.json`, written
  atomically. Keep it so: a killed job must leave no half verse and must start again where it stopped.
- **The studio listens on 127.0.0.1 only**, checks Host and Origin, and takes JSON bodies of at most 1 MB. Keep it
  that way: it can start jobs and read audio files.
- **Text comes from the public website API** (`/api/web/content/...`), paced under its 180-a-minute limit.
- Engines import torch lazily, so the tests run without the models: `./setup.sh --no-engines && pytest`
  (the fake engine stands in; ffmpeg is needed). Some tests start real worker processes and a real studio
  server on a free port, so the suite takes about half a minute.
- Python 3.11 for the engines (Kokoro/misaki need < 3.13, parler-tts pins transformers 4.46.1).

## Status

**The studio is built and tested with the fake engine only** (`pytest`: 92 tests, including real background jobs
that are stopped, killed and restarted, and a real studio server); the page was looked at in headless Chrome
(light, dark, phone width) with no console errors. **A job has never been run through the studio with a real
voice**, so the real speed, memory and a stop in the middle of a Parler verse are untested there. The voice test
(`sakha-speech sample`) has run on the owner's Mac with Indic Parler-TTS: it took 1.1 to 2.5 seconds per character
(`work/samples/*/*/info.json`), so a verse is minutes, a chapter hours and the Gita days. **Kokoro has not run**, and
`setup.sh` was not re-run for the studio. The Gita's cast (`characters/bhagavad-gita.json`: 5 characters, 701
verses) comes from the research beside it and has not been read through verse by verse by a person. **The
Bhagavatam has no cast and no fetched text, and `books.yaml` lists only the Gita**, so the canto folder in the
layout is covered by tests but has never been made from real data. The spoken text of a verse still begins with
"Arjuna said:" in Arjuna's own voice. Nothing has been uploaded, and the backend does not read `_index.json` yet
(a `VerseNarration` table and a `narrationUrl` in the reader API are the next change), so uploaded audio reaches
no reader.
