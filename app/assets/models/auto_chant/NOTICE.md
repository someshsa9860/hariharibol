# Auto-count model

One bundled ONNX model, Apache-2.0, from [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx):

| Path | Model | Size |
|---|---|---|
| `vad/silero_vad.onnx` | Silero VAD — is anyone making sound | 0.6 MB |

Auto count does not try to read the mantra. It counts sound: one chant for each standard chanting time
of it (`Mantra.durationMs`), so it works for any mantra in any language. See
`core/constants/auto_chant_config.dart` and [app/CLAUDE.md](../../../CLAUDE.md)'s chant counter section.

Earlier versions also bundled a 6 MB English-only recogniser (`kws/`) whose output was matched to a list of
allowed words per mantra, and offered a 365 MB download of Meta's Omnilingual ASR. Both were removed — the
words the recogniser wrote for Sanskrit were too unlike the lists to count anything. They are in git history.
`tool/auto_chant_bench/` is the offline bench from that time, kept for reference.

## Adding a mantra

Give it a standard chanting time on the admin **Mantras** page. No app change.
