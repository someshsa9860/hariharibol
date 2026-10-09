# Auto-count models

Two bundled ONNX models, both Apache-2.0, both from
[k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx):

| Path | Model | Size |
|---|---|---|
| `vad/silero_vad.onnx` | Silero VAD | 0.6 MB |
| `kws/{encoder,decoder,joiner}.onnx`, `kws/tokens.txt` | `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (int8 encoder and joiner from the full release; **not** the `-mobile` archive) | 6.0 MB |

The model is a small English-BPE streaming Zipformer transducer — a small speech
recogniser. Auto-count and word detection both run it through sherpa-onnx's
`OnlineRecognizer`. See `core/constants/auto_chant_config.dart` and
[app/CLAUDE.md](../../../CLAUDE.md)'s chant counter section.

Because the acoustic model was trained on English speech, results are best for
mantras whose sounds map onto English phonemes reasonably well (which is most
Romanised Sanskrit chanting). It is not a Sanskrit model — that is a known,
accepted limitation of this MVP, not an oversight.

## Optional download: the sharper recogniser

Not bundled — 365 MB. A person can download it from the chanting helpers sheet and auto count then
uses it instead of the model above (which stays as the fallback, and still serves word detection).

| | |
|---|---|
| Model | Meta **Omnilingual ASR 300M CTC**, int8 (`sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12`, `model.int8.onnx` + `tokens.txt`) |
| Licence | Apache-2.0 (Meta Platforms) |
| Size | 365.4 MB model + 86 KB tokens; about 1 GB of memory while decoding |
| Why | The bundled model is English-only, so it writes Sanskrit as English words (the Rama mantra counted 1 time in 18 on the bench). This one writes the chant, in Devanagari. |
| Host | Not set. Build with `--dart-define=AUTO_CHANT_MODEL_URL=<folder holding both files>`; with none, nothing is offered. |
| Checked | Each file's size and SHA-256 (`AutoChantConfig`) — a download that fails is deleted, never loaded: a model the native library cannot read ends the app. |

It has no language setting and may write a chant in any Indic script, so the matcher folds every Indic script
to the same sounds (`lib/services/indic_sounds.dart`). Measured offline in `tool/auto_chant_bench/`.

## Adding a mantra

Nothing to do in the app. Auto-count transcribes the chant with the model above and matches
the text against the mantra's `chantPhrases` from the API (a few plain-Roman spellings of one
full repetition, set in `backend/prisma/seed/chant-phrases.js`; the transliteration is the
fallback). A repetition counts at 50% or better (65% with the sharper recogniser), stricter for very short mantras — see
`lib/services/mantra_phrase_matcher.dart`. The `kws/` folder name is historical: the same
model is used as a recogniser, not a keyword spotter.
