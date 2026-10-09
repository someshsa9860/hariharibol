import lib, sys
from score import *
cand=sys.argv[1]
for reach in (None,2.0,1.5,1.25):
    lib.REACH=reach; SKIP.clear()
    for slug in ("pranava-om","om-namah-shivaya","om-namo-bhagavate-vasudevaya","rama-taraka-mantra"):
        res=json.load(open(f"{RESULTS}/{cand}.json")); mm=Matcher(targets(slug), indic.fold2 if cand.startswith("omni") else fold, 0.65 if cand.startswith("omni") else .5)
        hit=n=fp=0
        for f,segs in res.items():
            m=meta[f]; c=sum(mm.count_final(t) for t,_ in segs)
            if m["kind"]=="pos" and m["slug"]==slug and m["cond"] in("clean","snr20") : n+=1; hit+= c==m["reps"]
            if m["kind"]=="neg": fp+=c
            if m["kind"]=="pos" and m["slug"]!=slug: fp+=c
        print(f"{cand} reach {reach}: {slug:30s} exact {hit}/{n}  false(neg+cross) {fp}")
