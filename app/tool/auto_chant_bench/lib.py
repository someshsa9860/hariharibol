import re, json, os, time
import numpy as np, soundfile as sf, sherpa_onnx
from common import *
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VAD_MODEL = REPO + "/assets/models/auto_chant/vad/silero_vad.onnx"
CHUNK = 1600; PREROLL = 9600; PAD = 6400

def segments(x):
    """Same gate as mantra_detection_engine.dart: 100 ms chunks, voiced chunks (plus up to 0.6 s
    pre-roll at onset) form one utterance that ends when the VAD drops. Returns list of float32 arrays."""
    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = VAD_MODEL; cfg.silero_vad.threshold = 0.5
    cfg.silero_vad.min_silence_duration = 0.5; cfg.silero_vad.min_speech_duration = 0.25
    cfg.silero_vad.max_speech_duration = 20.0; cfg.sample_rate = 16000; cfg.num_threads = 1
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=30)
    segs, cur, active, pre, pres = [], None, False, [], 0
    for i in range(0, len(x), CHUNK):
        c = x[i:i+CHUNK]
        pre.append(c); pres += len(c)
        while pres > PREROLL and len(pre) > 1: pres -= len(pre.pop(0))
        vad.accept_waveform(c)
        while not vad.empty(): vad.pop()
        a = vad.is_speech_detected()
        if a and not active:
            cur = list(pre); pre = []; pres = 0
        elif a: cur.append(c)
        elif active and not a:
            segs.append(np.concatenate(cur)); cur = None
        active = a
    if active and cur: segs.append(np.concatenate(cur))
    return segs

# ---- exact port of MantraPhraseMatcher (fold, needed, best-ratio, update) ----
DIG = [("SH","S"),("CH","C"),("PH","F"),("TH","T"),("DH","D"),("BH","B"),("KH","K"),("GH","G"),("JH","J")]
DIA = dict(zip("ĀāĪīŪūṚṛṝṢṣŚśṆṇṬṭḌḍṀṁṂṃḤḥÑñṄṅ","AAIIUURRRSSSSNNTTDDMMMMHHNNNN"))
def fold(s):
    s = "".join(DIA.get(c,c) for c in s).upper(); s = re.sub(r"[^A-Z]","",s)
    for a,b in DIG: s = s.replace(a,b)
    out=[]; last=None
    for ch in s:
        f = {"W":"V","Q":"K","C":"K","Z":"S","E":"I","I":"I","Y":"I","O":"U","U":"U"}.get(ch,ch)
        if f=="H" or f==last: continue
        out.append(f); last=f
    return "".join(out)
THRESH=.5; SHORT_EXTRA=.25; SHORT_LETTERS=24; SLACK=.1; STRONG=.85; SETTLE=.3
def needed(n, thresh=THRESH):
    return thresh + SHORT_EXTRA*(0 if n>=SHORT_LETTERS else SHORT_LETTERS-n)/SHORT_LETTERS
def last_row(t, s):
    prev = list(range(0)) or [0]*(len(s)+1)
    for i in range(1, len(t)+1):
        cur=[i]+[0]*len(s)
        for j in range(1,len(s)+1):
            cur[j]=min(prev[j-1]+(t[i-1]!=s[j-1]), prev[j]+1, cur[j-1]+1)
        prev=cur
    return prev
REACH=None
def match(t, s, thresh=THRESH):
    n=len(t)
    if not s: return None
    row=last_row(t,s); low=min(row); fl=needed(n,thresh); best=(n-low)/n
    if best<fl: return None
    cut=max(best-SLACK, fl)
    for j in range(1,len(s)+1):
        r=(n-row[j])/n
        if r>=cut:
            if REACH and n<SHORT_LETTERS and j>REACH*n: return None
            return (r,j,n)
def best_ratio(t,s):
    return (len(t)-min(last_row(t,s)))/len(t) if s else 0
class Matcher:
    def __init__(s, phrases, foldfn=fold, thresh=THRESH):
        s.f=foldfn; s.t=[s.f(p) for p in phrases if s.f(p)]; s.th=thresh
    def count_final(s, text):
        heard=s.f(text); used=0; n=0
        while True:
            rest=heard[used:]; best=None
            for t in s.t:
                m=match(t,rest,s.th)
                if m and (best is None or m[0]>best[0]): best=m
            if not best: return n
            n+=1; used+=best[1]
    def closest(s, text):
        heard=s.f(text)
        return max((best_ratio(t,heard) for t in s.t), default=0)
