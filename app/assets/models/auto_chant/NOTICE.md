# Auto-count models

Two bundled ONNX models, both Apache-2.0, both from
[k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx):

| Path | Model | Size |
|---|---|---|
| `vad/silero_vad.onnx` | Silero VAD | 0.6 MB |
| `kws/{encoder,decoder,joiner}.onnx`, `kws/tokens.txt` | `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (int8 encoder and joiner from the full release; **not** the `-mobile` archive) | 6.0 MB |

The KWS model is a small English-BPE streaming Zipformer transducer, repurposed
as an **open-vocabulary keyword spotter** — it can spot any phrase expressible
in its ~500-piece BPE vocabulary without retraining, by tokenising the phrase
and treating it as a keyword the beam search watches for. See
`core/constants/auto_chant_config.dart` for how a mantra's tokens are wired in,
and [app/CLAUDE.md](../../../CLAUDE.md)'s auto-count section for the fuller
architecture writeup.

Because the acoustic model was trained on English speech, results are best for
mantras whose sounds map onto English phonemes reasonably well (which is most
Romanised Sanskrit chanting). It is not a Sanskrit model — that is a known,
accepted limitation of this MVP, not an oversight.

## Adding a mantra

Tokens are produced offline against the bundled `bpe.model` (kept out of the
app bundle — only the runtime `tokens.txt` ships) with sherpa-onnx's own
converter:

```bash
pip install sherpa-onnx sentencepiece
python3 -c "
import sentencepiece as spm
sp = spm.SentencePieceProcessor()
sp.load('bpe.model')
print(' '.join(sp.encode('YOUR PHRASE IN CAPS', out_type=str)))
"
```

`bpe.model` and the model files are in the release tarball:
<https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2>

**Do not swap in the `-mobile` archive's encoder.** Its `encoder-…int8.onnx` fails on its own
declared input (`Reshape '/downsample/Reshape_1'`, input `{17,1,128}` vs `{8,2,1,128}`), and
sherpa-onnx reports that as an uncaught C++ exception, which aborts the whole app
(SIGABRT) — Dart cannot catch it. The full release's encoder runs cleanly.

Paste the printed token string into a new `MantraKeyword` entry in
`auto_chant_config.dart`, keyed by the mantra's slug. Prefer spotting a short,
distinctive, repeated cue over the whole phrase for long mantras (see the
mahamantra's `detectionsPerRepetition: 2` on "Hare Hare") — a long token
sequence gives the beam search more places for one mispronounced syllable to
derail the whole match.
