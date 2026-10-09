import sys, os, json, random, itertools
import numpy as np, soundfile as sf, sherpa_onnx
from scipy.signal import resample_poly
from common import *
os.makedirs(CORP, exist_ok=True)
def tts(voice):
    d = f"{M}/{voice}/{voice}"
    onnx = [f for f in os.listdir(d) if f.endswith(".onnx")][0]
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=f"{d}/{onnx}", tokens=f"{d}/tokens.txt", data_dir=f"{d}/espeak-ng-data"), num_threads=4))
    return sherpa_onnx.OfflineTts(cfg)
def say(t, text, speed, sid=0):
    a = t.generate(text, sid=sid, speed=speed)
    x = np.array(a.samples, dtype=np.float32)
    return resample_poly(x, 16000, a.sample_rate) if a.sample_rate != 16000 else x
HI = ["vits-piper-hi_IN-pratham-medium","vits-piper-hi_IN-priyamvada-medium","vits-piper-hi_IN-rohan-medium"]
EN = ["vits-piper-en_US-amy-low","vits-piper-en_US-ryan-low"]
meta = []
def save(name, x, **kw):
    sf.write(f"{CORP}/{name}.wav", x, 16000); meta.append(dict(file=name+".wav", **kw))
rng = random.Random(1)
for v in HI:
    t = tts(v)
    for slug,(dev,_) in MANTRAS.items():
        for speed in (0.8, 1.0, 1.3):   # piper speed: >1 faster
            one = say(t, dev, speed)
            save(f"pos1_{slug}_{v[-14:]}_{speed}", one, kind="pos", slug=slug, reps=1)
            gap = lambda: np.zeros(int(rng.uniform(0.25, 0.6)*16000), np.float32)
            save(f"pos3_{slug}_{v[-14:]}_{speed}", np.concatenate([one, gap(), one, gap(), one]), kind="pos", slug=slug, reps=3)
    # Hindi negatives: ordinary sentences
    for i, s in enumerate(["आज मौसम बहुत अच्छा है और हम बाजार जा रहे हैं","मुझे एक गिलास पानी चाहिए","कल सुबह मैं दफ्तर जाऊँगा और फिर घर वापस आऊँगा","यह किताब बहुत दिलचस्प है","भारत की राजधानी नई दिल्ली है"]):
        save(f"neg_hi{i}_{v[-14:]}", say(t, s, 1.0), kind="neg", slug="hindi-sentence", reps=0)
for v in EN:
    t = tts(v)
    for i, s in enumerate(["The weather is lovely today and we are going to the market","Please turn the radio down I am trying to sleep","She sells sea shells by the sea shore","I will see you tomorrow morning at the office","Ram and Sita went to the market to buy some mangoes"]):
        save(f"neg_en{i}_{v[-8:]}", say(t, s, 1.0), kind="neg", slug="english-sentence", reps=0)
json.dump(meta, open(CORP+"/meta.json","w"), indent=1)
print(len(meta), "clips")
