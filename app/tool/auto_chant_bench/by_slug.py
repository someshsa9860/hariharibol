import sys, collections
from score import *
SKIP.add('pranava-om')
cand=sys.argv[1]; ff = indic.fold2 if len(sys.argv)>2 else fold
for slug in MANTRAS:
    if slug in SKIP: continue
    cond,fp,_,_=score(cand, ff, only=lambda m,s=slug: m["slug"]==s)
    e=sum(v[0] for k,v in cond.items() if k[0]=="clean"); n=sum(v[2] for k,v in cond.items() if k[0]=="clean")
    e10=sum(v[0] for k,v in cond.items() if k[0]=="snr10"); n10=sum(v[2] for k,v in cond.items() if k[0]=="snr10")
    print(f"{slug:32s} clean {e}/{n}  snr10 {e10}/{n10}")
