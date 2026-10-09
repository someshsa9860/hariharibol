import sys, json, collections, numpy as np, soundfile as sf
from lib import *
import indic
meta = {m["file"]: m for m in json.load(open(CORP+"/aug_meta.json"))}
def targets(slug, deva=True, roman=True):
    d, r = MANTRAS[slug]; return ([d] if deva else []) + (r if roman else [])
SKIP=set()
def score(cand, foldfn, deva=True, roman=True, thresh=THRESH, verbose=False, only=None):
    res = json.load(open(f"{RESULTS}/{cand}.json"))
    ms = {s: Matcher(targets(s,deva,roman), foldfn, thresh) for s in MANTRAS if s not in SKIP}
    cond = collections.defaultdict(lambda: [0,0,0])  # exact, hit, n
    wrong = 0; npos = 0; worst = 0; fp = collections.Counter(); negmin = 0; ntot=0; lat=[]
    for f, segs in res.items():
        m = meta[f]
        if only and not only(m): continue
        texts = [t for t,_ in segs]; lat += [x for _,x in segs]
        counts = {s: sum(mm.count_final(t) for t in texts) for s,mm in ms.items()}
        if m["kind"] == "pos" and m["slug"] in SKIP: continue
        if m["kind"] == "pos":
            c = cond[(m["cond"], m["reps"])]; c[2]+=1; c[0]+= counts.get(m["slug"],m['reps'])==m["reps"]; c[1]+= counts.get(m["slug"],m['reps'])>=1
            for s,n in counts.items():
                if s!=m["slug"] and n>0: fp["cross-mantra"]+=n
        else:
            n = sum(counts.values()); 
            if n: fp[m["slug"]]+=n
            negmin += len(sf.read(f"{CORP}/{f}")[0])/16000/60
    return cond, fp, negmin, (np.mean(lat) if lat else 0, max(lat) if lat else 0)
def show(cand, foldfn, label=None, **kw):
    cond, fp, negmin, lat = score(cand, foldfn, **kw)
    row = []
    for c in ("clean","snr20","snr10","rev20"):
        for r in (1,3):
            e,h,n = cond[(c,r)]; row.append(f"{c}x{r}:{e}/{n}")
    print(f"{label or cand:28s} " + " ".join(row) + f" | false {dict(fp)} over {negmin:.0f} min neg | seg ms mean {lat[0]:.0f} max {lat[1]:.0f}")
if __name__ == "__main__":
    SKIP.add('pranava-om')
    c = sys.argv[1]
    show(c, fold, "roman-fold"); show(c, indic.fold2, "indic-fold")
