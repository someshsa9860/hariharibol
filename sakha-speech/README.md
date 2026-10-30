# Sakha Speech

Makes HariHariBol's narration audio **ahead of time** and uploads it to S3, so readers only play an MP3.
v1: the Bhagavad Gita's verse meanings in English and Hindi, each character in a voice you choose.

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

## The studio (a window for all of this)

```bash
sakha-speech fetch --book bhagavad-gita          # once, with internet: the text is kept in work/text/
sakha-speech studio                              # http://127.0.0.1:8766, opens in the browser
```

1. **Choose the book**, then the **chapters** (all, or tick some).
2. The page lists **the characters who speak in those chapters** (Krishna, Arjuna, Sanjaya, Dhritarashtra,
   Duryodhana, with how many verses each has there) and a **voice menu for each, per language**, with a ▶ beside
   it. Below, **Hear the voices** has a demo for every voice the chosen languages have (press *Make demo*;
   each voice reads the same few lines, a minute or two per voice, no internet needed), so you can listen
   before you choose. A character with no voice chosen is spoken by the book's narrator of the same gender
   (`books.yaml`); the choice is kept in `characters/<book>.voices.json`. A book with no cast has one
   *Narrator* to give a voice to.
3. **Start.** The job runs in the background (a separate process, kept awake with `caffeinate`), so closing the
   tab or the terminal does not stop it. Come back to the page any time: it shows the bar, verses done of total,
   the verse being spoken, the speed and **the time left**, and the last few verses made.
4. **Stop** waits for the sentence being spoken, then ends; **Stop now** ends the job at once. Either way
   everything finished is kept and only the verse being spoken is lost. If the Mac sleeps or restarts, the job shows
   as *interrupted*, and *Start* carries on from the first verse not made.

Verses already made are **skipped, not made again**: a verse is remade only when its text, its voice or the
pipeline changed, so starting the same chapters twice makes nothing the second time, and changing one
character's voice remakes only that character's verses. Everything is written to this folder, so it works
**without internet** once the text is fetched.

How long it takes: in the voice test on this Mac, Indic Parler-TTS took **1.1 to 2.5 seconds for each character** of
text, depending on the voice (`computeSeconds` in `work/samples/<lang>/<voice>/info.json`). That is **about 3 to 6
minutes for a verse, hours for a chapter, and days for the whole Gita in two languages.** The time left the page
shows is worked out from the speed so far and settles after a few verses; before any verse is made it uses the voice
test. Run it overnight, a chapter or two at a time.

## Use

```bash
sakha-speech studio                                   # the window above (everything below also works without it)
sakha-speech voices                                    # voices, and which book each one narrates
sakha-speech fetch --book bhagavad-gita                # the text, from the website API, kept in work/text/
sakha-speech sample --lang en                          # voice test: open work/samples/index.html and listen
sakha-speech sample --lang hi
# give each character a voice in the studio (or set the fallback narrators in books.yaml), then:
sakha-speech generate --book bhagavad-gita --lang hi --chapter 2   # try one chapter, here in the terminal
sakha-speech review                                    # http://localhost:8765: listen, Keep or Make again
sakha-speech generate --book bhagavad-gita             # everything: both languages
sakha-speech status
sakha-speech upload --book bhagavad-gita --dry-run     # what would go up
sakha-speech upload --book bhagavad-gita
```

`generate` does what the studio's Start does, in the terminal (it uses the voices chosen in the studio). Every
command can be stopped with Ctrl-C and run again: it carries on where it stopped and never makes a verse twice
unless its text, its voice or the pipeline changed.

If the API has no Hindi meanings (rows imported from the Claude translation stay hidden until
published), read the translation runs' saved files instead: `sakha-speech fetch --book bhagavad-gita --lang hi --source s3`
(needs the AWS keys). Any other text: `--source my-file.json` with `{"1.2.47": "text", ...}`.

## Files

| File | What it is |
|---|---|
| `voices.yaml` | every voice: language, gender, engine, licence, and the engine's settings. Add a voice here. |
| `books.yaml` | what to narrate, and the **fallback narrators** (one per language and gender) for a character with no voice chosen. |
| `characters/<book>.json` | the book's cast: its characters (names per language, gender), its chapters, and which character speaks each verse. Committed. `bhagavad-gita.json` has 5 characters over 701 verses; `.md` and `.yaml` beside it are the research it was built from. |
| `characters/<book>.voices.json` | the voices you chose in the studio: `{language: {character: voice id}}`. Written by the studio. |
| `lexicon/<lang>.yaml` | how to say words a voice gets wrong. |
| `samples.yaml` | the voice test's lines. |
| `sakha_speech/` | the code: `cli.py` (commands), `studio.py` + `studio.html` (the window), `jobs.py` (the background job), `plan.py` (what is left to make), `cast.py` (characters and voices), `speed.py` (the time left), `content.py` (text), `text.py` (spelling, sentences), `engines/` (Kokoro, Parler), `audio.py` (join, check, MP3), `generate.py`, `keys.py` (file names), `manifest.py`, `s3.py`, `review.py`, `sample.py`. |
| `narration/` | gitignored: the finished MP3s, laid out for S3 (below). Move it with `SAKHA_AUDIO_DIR`. |
| `work/` | gitignored: fetched text, manifests, jobs (`work/jobs/<id>/`: spec, status, log), voice demos and samples, learned speed. |

## Where the audio goes

On this computer, as the job makes it, and the same shape in S3 (the folder `narration/` is what goes under
`s3://$S3_BUCKET/narration/`):

```
narration/<book>/<lang>/<chapter>/<verse>.mp3              (Gita:  narration/bhagavad-gita/hi/2/47.mp3)
narration/<book>/<lang>/<canto>/<chapter>/<verse>.mp3      (Bhagavatam: narration/srimad-bhagavatam/en/1/3/28.mp3)
narration/<book>/<lang>/_index.json                        (made by upload)
```

A verse's own meaning is `<verse>.mp3`; anything else made for it is `<verse>-<kind>.mp3` (`47-purport.mp3`).
There is **no voice in the path**: one chapter has several voices, one for each character, so the voice would
only scatter it. Which voice and which character spoke each verse is in the manifest
(`work/manifest/<book>/<lang>.json`) and in `_index.json`. A compound verse (16-18) is filed under its first
number, as the backend's `utils/verse-audio.js` does for recitations.

MP3, mono, 64 kbps, loudness-normalised to -16 LUFS. A file is written under another name and renamed when it
is complete, so a stopped or killed job never leaves half a verse. Uploading later is one command with
internet, `sakha-speech upload --book bhagavad-gita`, or `aws s3 sync narration s3://$S3_BUCKET/narration`
(upload also writes the `_index.json`, which names each verse's voice, character, length and text hash, for the
backend to import).

## If something goes wrong

- **"is gated"**: accept the model's terms on Hugging Face and run `hf auth login`.
- **An error about MPS**: run with `SAKHA_DEVICE=cpu` (slower) and tell us which voice.
- **A voice says a name wrong**: add it to `lexicon/<lang>.yaml`; the next `generate` re-makes only those verses.
- **The studio says a job is *interrupted***: its process was killed or the Mac restarted. Press *Start* again; it
  carries on from the first verse not made.
- **The studio says another job is running**: one job at a time. Wait for it, or press *Stop* on it.
- **Tests**: `./setup.sh --no-engines` is enough; then `pytest` (the fake engine stands in for the voices; some tests
  start real background jobs, so the suite takes about half a minute).
