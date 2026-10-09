# Auto-count bench

Offline harness behind the auto-count recogniser decision (see `lib/core/constants/auto_chant_config.dart`
and `assets/models/auto_chant/NOTICE.md`). It runs a recogniser over synthesised chanting (Hindi
text-to-speech, three voices, 0.8-1.3x speed, one and three repetitions, noise at 20 and 10 dB, reverb) and
over about 24 minutes of things that are not chanting, then scores it with a Python port of
`MantraPhraseMatcher` (the same folding, edit distance and bar as the app).

**Text-to-speech is cleaner than a real devotee.** Passing it is necessary, not sufficient. The bundled
model's result on it matched the owner's phone (English-looking garbage), which is what makes it a fair
proxy for *failures*; real recordings are still needed to confirm *successes*.

```
pip install sherpa-onnx==1.13.8 numpy soundfile scipy sentencepiece onnx
```

Models come from the `k2-fsa/sherpa-onnx` GitHub releases (`asr-models`, `tts-models`, `kws-models`) into
`work/models/<name>/` (set `BENCH_WORK` to put them elsewhere): the bundled model's original archive
(`sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01`, which has the `bpe.model` the app copy lacks),
`vits-piper-hi_IN-{pratham,priyamvada,rohan}-medium`, `vits-piper-en_US-{amy,ryan}-low`, and
`sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12`.

| Step | Command |
|---|---|
| Make the audio | `python gen_tts.py && python augment.py` |
| Transcribe with a candidate | `python run_cand.py greedy 1` / `omni300 4` / `whisper-small` |
| Score it | `python score.py omni300` (exact count per clip, false counts, per condition) |
| Sweep the match bar | `python sweep.py omni300` |
| One mantra at a time | `python by_slug.py omni300 indic` |
| Latency and memory | `python timing.py` |
| Hotwords / keyword spotter | `python hot_full.py 3.0 4` / `python try_kws.py` |

`indic.py` is the Python twin of `lib/services/indic_sounds.dart`; `test/fixtures/indic_fold_cases.json`
holds cases produced by it, which the Dart test checks.

## Real recordings

Nothing here records the phone. If the owner wants real chanting replayed offline, the app would need a
debug-only switch that saves each utterance's WAV locally (it never records audio today). Drop the files
into `work/corpus/`, list them in `aug_meta.json` and every command above works on them.
