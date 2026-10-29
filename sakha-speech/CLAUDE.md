# sakha-speech/ — narration generator (Python)

Makes narration MP3s ahead of time on the owner's Mac (or a GPU box) and uploads them to S3; readers
only play them. Read [README.md](README.md) for how it is used and [PLAN.md](PLAN.md) for why it is built this way.

## Rules

- **One narrator per book, language and gender.** Runs ask for book + language + gender and get the voice
  `books.yaml` names; never add a way to pick a voice per verse.
- **Voices are config, not code.** A new voice is an entry in `voices.yaml`; a new kind of model is one file
  in `sakha_speech/engines/` plus a branch in `engines/__init__.py`.
- **Commercial-safe licences only** in `voices.yaml` (HariHariBol has paid plans): no Coqui XTTS, Meta MMS
  or F5 base weights without the owner's decision. Each voice carries its `licence`.
- **Never make a verse twice for nothing.** The manifest hash covers spoken text + voice settings +
  `PIPELINE_VERSION` (`sakha_speech/__init__.py`); raise that only when every file should change.
- **The S3 layout mirrors `backend/utils/verse-audio.js`** (canto, chapter, verse; compound verse under its
  first number). Change `keys.py` and that file together, or not at all.
- **Text comes from the public website API** (`/api/web/content/...`), paced under its 180-a-minute limit.
- Engines import torch lazily, so the tests run without the models: `./setup.sh --no-engines && pytest`
  (the fake engine stands in; ffmpeg is needed).
- Python 3.11 for the engines (Kokoro/misaki need < 3.13, parler-tts pins transformers 4.46.1).

## Status

Written in a cloud session without the models (Hugging Face is blocked there): the unit tests pass with the
fake engine; **Kokoro and Indic Parler-TTS have never run, no sample or narration has been made, nothing
has been uploaded, and `setup.sh` has not run on a Mac.** The narrators in `books.yaml` are a first guess
until the voice test. The backend does not read `_index.json` yet (a `VerseNarration` table and a
`narrationUrl` in the reader API are the next change), so uploaded audio reaches no reader.
