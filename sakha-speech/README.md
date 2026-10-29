# Sakha Speech

Makes HariHariBol's narration audio **ahead of time** and uploads it to S3, so readers only play an MP3.
v1: the Bhagavad Gita's verse meanings in English and Hindi, a male and a female narrator each.

Runs on a Mac (Apple Silicon uses its GPU) or Linux (an NVIDIA GPU if there is one). Nothing here runs
on a reader's phone.

## Set up (once)

```bash
cd sakha-speech
./setup.sh                 # ffmpeg (Homebrew), uv, Python 3.11 in .venv, the speech models' packages, .env
source .venv/bin/activate
```

The Hindi voices use AI4Bharat's **Indic Parler-TTS**, which is gated: open
https://huggingface.co/ai4bharat/indic-parler-tts, accept its terms, then

```bash
hf auth login              # older huggingface_hub: huggingface-cli login
```

Models download on first use (about 3.5 GB for Parler, 330 MB for Kokoro) and are cached by Hugging Face.
Put the AWS keys in `.env` before uploading (`.env.example` lists every setting).

## Use

```bash
sakha-speech voices                                    # voices, and which book each one narrates
sakha-speech fetch --book bhagavad-gita                # the text, from the website API, kept in work/text/
sakha-speech sample --lang en                          # voice test: open work/samples/index.html and listen
sakha-speech sample --lang hi
# pick the narrators in books.yaml, then:
sakha-speech generate --book bhagavad-gita --lang hi --gender female --chapter 2   # try one chapter
sakha-speech review                                    # http://localhost:8765: listen, Keep or Make again
sakha-speech generate --book bhagavad-gita             # everything: both languages, both genders
sakha-speech status
sakha-speech upload --book bhagavad-gita --dry-run     # what would go up
sakha-speech upload --book bhagavad-gita
```

Every command can be stopped with Ctrl-C and run again: it carries on where it stopped and never makes a
verse twice unless its text, its voice or the pipeline changed.

If the API has no Hindi meanings (rows imported from the Claude translation stay hidden until
published), read the translation runs' saved files instead: `sakha-speech fetch --book bhagavad-gita --lang hi --source s3`
(needs the AWS keys). Any other text: `--source my-file.json` with `{"1.2.47": "text", ...}`.

## Files

| File | What it is |
|---|---|
| `voices.yaml` | every voice: language, gender, engine, licence, and the engine's settings. Add a voice here. |
| `books.yaml` | what to narrate and **one narrator per book, language and gender**. |
| `lexicon/<lang>.yaml` | how to say words a voice gets wrong. |
| `samples.yaml` | the voice test's lines. |
| `sakha_speech/` | the code: `cli.py` (commands), `content.py` (text), `text.py` (spelling, sentences), `engines/` (Kokoro, Parler), `audio.py` (join, check, MP3), `generate.py`, `manifest.py`, `s3.py`, `review.py`, `sample.py`. |
| `work/` | gitignored: fetched text, audio, manifests, samples. |

## Where the audio goes

```
s3://$S3_BUCKET/narration/<book>/<lang>/<voice>/<chapter>/<verse>-meaning.mp3        (Gita)
s3://$S3_BUCKET/narration/<book>/<lang>/<voice>/<canto>/<chapter>/<verse>-meaning.mp3
s3://$S3_BUCKET/narration/<book>/<lang>/<voice>/_index.json
```

MP3, mono, 64 kbps, loudness-normalised to -16 LUFS. A compound verse (16-18) is filed under its first
number, as the backend's `utils/verse-audio.js` does for recitations. `_index.json` names the voice
(language, gender, model) and lists every verse's key, length and text hash, for the backend to import.

## If something goes wrong

- **"is gated"**: accept the model's terms on Hugging Face and run `hf auth login`.
- **An error about MPS**: run with `SAKHA_DEVICE=cpu` (slower) and tell us which voice.
- **A voice says a name wrong**: add it to `lexicon/<lang>.yaml`; the next `generate` re-makes only those verses.
- **Tests**: `./setup.sh --no-engines` is enough; then `pytest`.
