import time, resource, numpy as np, soundfile as sf, sherpa_onnx, json
from lib import *
O=f"{M}/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12"
x=sf.read(CORP+"/pos3_rama-taraka-mantra_pratham-medium_1.0__clean.wav",dtype="float32")[0]
for th in (1,2,4):
    t=time.perf_counter(); r=sherpa_onnx.OfflineRecognizer.from_omnilingual_asr_ctc(model=O+"/model.int8.onnx",tokens=O+"/tokens.txt",num_threads=th); load=time.perf_counter()-t
    for sec in (2,4,8,16):
        seg=np.tile(x[8000:8000+32000],(sec//2+1))[:sec*16000]; best=1e9
        for _ in range(2):
            s=r.create_stream(); s.accept_waveform(16000,seg); t=time.perf_counter(); r.decode_stream(s); best=min(best,time.perf_counter()-t)
        print(f"threads {th}: {sec:2d}s of audio -> {best*1000:6.0f} ms (x{best/sec:.2f} realtime)")
    print(f"  load {load:.1f}s, peak RSS so far {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024:.0f} MB", flush=True)
