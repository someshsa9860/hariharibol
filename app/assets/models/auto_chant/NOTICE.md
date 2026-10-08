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

## Adding a mantra

Nothing to do in the app. Auto-count transcribes the chant with the model above and matches
the text against the mantra's `chantPhrases` from the API (a few plain-Roman spellings of one
full repetition, set in `backend/prisma/seed/chant-phrases.js`; the transliteration is the
fallback). A repetition counts at 50% or better, stricter for very short mantras — see
`lib/services/mantra_phrase_matcher.dart`. The `kws/` folder name is historical: the same
model is used as a recogniser, not a keyword spotter.
