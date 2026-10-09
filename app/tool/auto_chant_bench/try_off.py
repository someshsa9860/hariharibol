import sys, json, time, numpy as np, soundfile as sf, sherpa_onnx
from lib import *
def whisper(size, lang="hi"):
    d=f"{M}/sherpa-onnx-whisper-{size}/sherpa-onnx-whisper-{size}"
    return sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{d}/{size}-encoder.int8.onnx",decoder=f"{d}/{size}-decoder.int8.onnx",tokens=f"{d}/{size}-tokens.txt",language=lang,task="transcribe",num_threads=4)
def dolphin():
    d=f"{M}/sherpa-onnx-dolphin-base-ctc-multi-lang-int8-2025-04-02/sherpa-onnx-dolphin-base-ctc-multi-lang-int8-2025-04-02"
    return sherpa_onnx.OfflineRecognizer.from_dolphin_ctc(model=d+"/model.int8.onnx",tokens=d+"/tokens.txt",num_threads=4)
def off(r, seg):
    s=r.create_stream(); s.accept_waveform(16000, seg); t=time.perf_counter(); r.decode_stream(s); return s.result.text, (time.perf_counter()-t)*1000
if __name__=="__main__":
    meta=json.load(open(CORP+"/aug_meta.json"))
    sel=[m for m in meta if m["kind"]=="pos" and m["reps"]==1 and m["cond"]=="clean" and m["slug"]=="rama-taraka-mantra"]
    for name,mk in [("whisper-tiny",lambda:whisper("tiny")),("whisper-base",lambda:whisper("base")),("whisper-small",lambda:whisper("small")),("dolphin",dolphin)]:
        r=mk(); print("==",name)
        for m in sel[:9]:
            x=sf.read(f"{CORP}/{m['file']}",dtype="float32")[0]
            for seg in segments(x):
                t,ms=off(r,seg); print(f"  {m['file'][22:48]:26s} {ms:6.0f}ms {t!r}")
