# Auto-count models

Two bundled ONNX models, both Apache-2.0, both from
[k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx):

| Path | Model | Size |
|---|---|---|
| `vad/silero_vad.onnx` | Silero VAD — is anyone making sound | 0.6 MB |
| `kws/{encoder,decoder,joiner}.onnx`, `kws/tokens.txt` | `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (int8 encoder and joiner from the full release; **not** the `-mobile` archive) — a small English-BPE streaming recogniser | 6.0 MB |

The recogniser is trained on English only, so it writes Sanskrit as the nearest English words. Auto count
does not try to read the mantra: each mantra lists the English words the model is known to write for it
(`Mantra.chantWords`, admin **Mantras** page), and hearing one counts a chant, at most one per the mantra's
standard chanting time (`Mantra.durationMs`). A mantra with no words is counted by sound alone. See
`core/constants/auto_chant_config.dart` and [app/CLAUDE.md](../../../CLAUDE.md)'s chant counter section.

The `kws/` folder name is historical: the model is used as a recogniser, not a keyword spotter.

Earlier versions also offered a 365 MB download of Meta's Omnilingual ASR; it was removed.
`tool/auto_chant_bench/` is the offline bench from that time, kept for reference.

## Adding a mantra

Give it a standard chanting time and, once you know them, its allowed English words on the admin **Mantras**
page. No app change.
