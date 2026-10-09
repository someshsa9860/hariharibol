import sys
from score import *
SKIP.add('pranava-om')
cand=sys.argv[1]; ff = indic.fold2
for th in (0.5,0.6,0.65,0.7,0.75,0.8):
    cond,fp,negmin,_=score(cand, ff, thresh=th)
    tot=lambda c: (sum(v[0] for k,v in cond.items() if k[0]==c), sum(v[2] for k,v in cond.items() if k[0]==c))
    print(f"th {th}: clean {tot('clean')} snr20 {tot('snr20')} snr10 {tot('snr10')} rev20 {tot('rev20')} | neg false {sum(v for k,v in fp.items() if k!='cross-mantra')} cross-mantra {fp.get('cross-mantra',0)}", flush=True)
