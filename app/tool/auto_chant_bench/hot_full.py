import sys, json, tempfile, numpy as np, soundfile as sf, sherpa_onnx
from lib import *
from try_hot import mk
from run_baseline import transcribe
score, paths = float(sys.argv[1]), int(sys.argv[2])
meta = json.load(open(CORP+"/aug_meta.json"))
sel = [m for m in meta if (m["kind"]=="pos" and m["slug"]=="rama-taraka-mantra" and m["cond"] in ("clean","snr10") and m["reps"]==1) or m["kind"]=="neg"]
hot = tempfile.mktemp(); open(hot,"w").write("SHREE RAM JAI RAM JAI JAI RAM\nSREE RAMA JAYA RAMA JAYA JAYA RAMA\n")
r = mk(score, paths, hot); mm = Matcher(MANTRAS["rama-taraka-mantra"][1])
pos = {"clean":[0,0],"snr10":[0,0]}; fp = 0; mins = 0; worst = 0
import time
for m in sel:
    x = sf.read(f"{CORP}/{m['file']}",dtype="float32")[0]
    texts = []
    for seg in segments(x):
        t0=time.perf_counter(); txt,w = transcribe(r, seg); worst=max(worst,w); texts.append(txt)
    c = sum(mm.count_final(t) for t in texts)
    if m["kind"]=="pos": pos[m["cond"]][1]+=1; pos[m["cond"]][0]+= c==1
    else: fp += c; mins += len(x)/16000/60
print(f"hotwords score={score} paths={paths}: clean {pos['clean']} snr10 {pos['snr10']} false counts {fp} in {mins:.0f} min, worst chunk {worst:.0f} ms")
