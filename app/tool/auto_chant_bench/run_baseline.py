import sys, json, time, numpy as np, soundfile as sf, sherpa_onnx
from lib import *
d=f"{M}/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01"
def rec(**kw):
    return sherpa_onnx.OnlineRecognizer.from_transducer(tokens=d+"/tokens.txt",
      encoder=d+"/encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",decoder=d+"/decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
      joiner=d+"/joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",num_threads=1,**kw)
def transcribe(r, seg, pad=PAD, per_chunk=False):
    s=r.create_stream(); worst=0
    for i in range(0,len(seg),CHUNK):
        t=time.perf_counter(); s.accept_waveform(16000, seg[i:i+CHUNK])
        while r.is_ready(s): r.decode_stream(s)
        worst=max(worst,(time.perf_counter()-t)*1000)
    s.accept_waveform(16000, np.zeros(pad,np.float32))
    while r.is_ready(s): r.decode_stream(s)
    return r.get_result(s), worst
if __name__=="__main__":
    meta=json.load(open(CORP+"/aug_meta.json")); r=rec(decoding_method="greedy_search")
    sel=[m for m in meta if m["kind"]=="pos" and m["reps"]==1 and m["cond"]=="clean" and m["slug"]=="rama-taraka-mantra"]
    M_=Matcher(MANTRAS["rama-taraka-mantra"][1])
    for m in sel:
        x=sf.read(f"{CORP}/{m['file']}",dtype="float32")[0]
        for seg in segments(x):
            txt,_=transcribe(r,seg); print(f"{m['file'][:48]:48s} {len(seg)/16000:4.1f}s  {M_.closest(txt):.2f}  {txt!r}")
