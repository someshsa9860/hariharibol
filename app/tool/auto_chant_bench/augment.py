import json, os, random
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve
from common import *
rng = np.random.default_rng(7)
meta = json.load(open(CORP+"/meta.json"))
def rms(x): return float(np.sqrt(np.mean(x**2))+1e-9)
def noise(n, kind):
    w = rng.standard_normal(n).astype(np.float32)
    if kind == "pink":  # cheap 1/f-ish: integrate-leak white
        out = np.zeros_like(w); a = 0.0
        for i in range(n): a = 0.97*a + w[i]; out[i] = a
        w = out
    return w
def mix(x, snr, kind):
    n = noise(len(x), kind); n *= rms(x)/rms(n)/(10**(snr/20)); return (x+n).astype(np.float32)
def reverb(x, rt60=0.35):
    t = np.arange(int(rt60*16000))/16000; ir = rng.standard_normal(len(t))*np.exp(-6.9*t/rt60); ir[0]=1.0
    y = fftconvolve(x, ir.astype(np.float32))[:len(x)+4000]; return (y*rms(x)/rms(y)).astype(np.float32)
def rd(f): return sf.read(f"{CORP}/{f}", dtype="float32")[0]
out = []
def put(name, x, **kw):
    x = np.clip(x, -1, 1); sf.write(f"{CORP}/{name}.wav", x, 16000); out.append(dict(file=name+".wav", **kw))
for m in meta:
    x = rd(m["file"]); b = m["file"][:-4]
    kw = {k:v for k,v in m.items() if k!="file"}
    pad = np.zeros(8000, np.float32)  # half a second of room each side, like a real sitting
    x = np.concatenate([pad, x, pad])
    put(b+"__clean", x, cond="clean", **kw)
    put(b+"__snr20", mix(x, 20, "white" if rng.random()<.5 else "pink"), cond="snr20", **kw)
    put(b+"__snr10", mix(x, 10, "white" if rng.random()<.5 else "pink"), cond="snr10", **kw)
    put(b+"__rev20", mix(reverb(x), 20, "pink"), cond="rev20", **kw)
# long negatives: ~12 min of non-chant: sentences from all voices, gaps, room noise, silence
negs = [m for m in meta if m["kind"]=="neg"]
clips = [rd(m["file"]) for m in negs]
long = []
tot = 0
while tot < 12*60*16000:
    parts = []
    for _ in range(40):
        c = clips[rng.integers(len(clips))]
        parts += [c, np.zeros(int(rng.uniform(.3,3)*16000), np.float32)]
    x = np.concatenate(parts); x = mix(x, float(rng.choice([30,20,10])), "pink"); long.append(x); tot += len(x)
for i, x in enumerate(long):
    put(f"neglong{i}", np.concatenate([np.zeros(8000,np.float32), x]), kind="neg", slug="long-negative", reps=0, cond="long")
# silence/noise only, 3 minutes
for i,(kind, lvl) in enumerate([("white",0.01),("pink",0.03),("white",0.0005)]):
    n = noise(60*16000, kind); n = n/ (np.abs(n).max()+1e-9) * lvl; put(f"neg_noise{i}", n.astype(np.float32), kind="neg", slug="noise", reps=0, cond="noise")
json.dump(out, open(CORP+"/aug_meta.json","w"), indent=1)
print(len(out), "clips", sum(1 for o in out if o["kind"]=="pos"), "pos; neg minutes", sum(len(sf.read(f"{CORP}/{o['file']}")[0]) for o in out if o["kind"]=="neg")/16000/60)
