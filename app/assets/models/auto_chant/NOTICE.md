# Auto-count model

One bundled ONNX model, Apache-2.0 / MIT, from
[k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx):

| Path | Model | Size |
|---|---|---|
| `vad/silero_vad.onnx` | Silero VAD | 0.6 MB |

It only answers "is someone making sound right now". Nothing is recognised, so it works the
same for Sanskrit as for any language. Auto count counts one chant for each *standard time*
(`Mantra.durationMs`) of sound — see `core/constants/auto_chant_config.dart` and
[app/CLAUDE.md](../../../CLAUDE.md)'s chant counter section.

Earlier versions also bundled a 6 MB English speech recogniser (`kws/`) and offered a 365 MB
download of Meta's Omnilingual ASR; both were removed. `tool/auto_chant_bench/` is the offline
bench from that time and is kept for reference only.

## Adding a mantra

Give it a standard chanting time on the admin **Mantras** page (milliseconds for one chant).
A mantra with none is taken to need 0.2 s per letter of its text, never less than 1 s.
