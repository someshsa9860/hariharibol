"""usage: run_cand.py <candidate> [threads] [subset]  -> writes results/<cand>.json {file: [[text, ms], ...]}"""
import sys, json, os, time
import numpy as np, soundfile as sf, sherpa_onnx
from lib import *
from run_baseline import rec, transcribe, d as KWS
from try_off import whisper, off
cand = sys.argv[1]; threads = int(sys.argv[2]) if len(sys.argv)>2 else 4; subset = sys.argv[3] if len(sys.argv)>3 else "all"
os.makedirs(RESULTS, exist_ok=True)
OMNI=f"{M}/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12"
def build():
    if cand.startswith("omni"): 
        r = sherpa_onnx.OfflineRecognizer.from_omnilingual_asr_ctc(model=(os.environ.get("OMNI_MODEL") or OMNI+"/model.int8.onnx"),tokens=OMNI+"/tokens.txt",num_threads=threads)
        return lambda seg: off(r,seg)
    if cand.startswith("whisper-"):
        r = whisper(cand.split("-")[1]); return lambda seg: off(r,seg)
    if cand.startswith("greedy"):
        pad = int(cand.split("_pad")[1]) if "_pad" in cand else PAD
        r = rec(decoding_method="greedy_search")
        def f(seg):
            res,ms = transcribe(r,seg,pad=pad); return res.text if hasattr(res,'text') else res, ms
        return f
    raise SystemExit("unknown "+cand)
fn = build()
meta = json.load(open(CORP+"/aug_meta.json"))
if subset == "quick": meta = [m for m in meta if m["cond"] in ("clean","snr10") and (m["kind"]=="neg" or m["reps"]==1)][:400]
out = {}; t0=time.time()
for i,m in enumerate(meta):
    x = sf.read(f"{CORP}/{m['file']}",dtype="float32")[0]
    out[m["file"]] = [list(fn(seg)) for seg in segments(x)]
    if i%50==0: print(cand, i, len(meta), f"{time.time()-t0:.0f}s", flush=True)
json.dump(out, open(f"{RESULTS}/{cand}.json","w"))
print("done", cand, f"{time.time()-t0:.0f}s")
