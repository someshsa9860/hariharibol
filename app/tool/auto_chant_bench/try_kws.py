import sys, json, itertools, tempfile, numpy as np, soundfile as sf, sherpa_onnx, sentencepiece as spm
from lib import *
from run_baseline import d as KWS
sp = spm.SentencePieceProcessor(model_file=KWS+"/bpe.model")
ROMAN_KW = {  # Roman spellings an English BPE can hold; one keyword = one full repetition
 "rama-taraka-mantra": ["SHREE RAM JAI RAM JAI JAI RAM","SRI RAMA JAYA RAMA JAYA JAYA RAMA"],
 "om-namah-shivaya": ["OM NAMAH SHIVAYA","OM NAMA SHIVAY"],
 "om-namo-bhagavate-vasudevaya": ["OM NAMO BHAGAVATE VASUDEVAYA"],
 "hare-krishna-mahamantra": ["HARE KRISHNA HARE KRISHNA KRISHNA KRISHNA HARE HARE"],
 "krishna-gayatri":["OM DEVAKINANDANAYA VIDMAHE VASUDEVAYA DHIMAHI TANNO KRISHNA PRACHODAYAT"],
 "maha-mrityunjaya-mantra":["OM TRYAMBAKAM YAJAMAHE SUGANDHIM PUSHTIVARDHANAM"],
 "nrisimha-mantra":["UGRAM VIRAM MAHA VISHNUM JVALANTAM SARVATO MUKHAM"]}
def kwfile(slug, boost, thr):
    p = tempfile.mktemp(); open(p,"w").write("".join(" ".join(sp.encode(k,out_type=str))+f" :{boost} #{thr} @{slug}\n" for k in ROMAN_KW[slug])); return p
def spot(slug, boost, thr, seg):
    k = sherpa_onnx.KeywordSpotter(tokens=KWS+"/tokens.txt",encoder=KWS+"/encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        decoder=KWS+"/decoder-epoch-12-avg-2-chunk-16-left-64.onnx",joiner=KWS+"/joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        keywords_file=kwfile(slug,boost,thr),num_threads=1,keywords_score=boost,keywords_threshold=thr)
    s = k.create_stream(); n = 0
    for i in range(0,len(seg),CHUNK):
        s.accept_waveform(16000, seg[i:i+CHUNK])
        while k.is_ready(s):
            k.decode_stream(s); r = k.get_result(s)
            if r: n += 1; k.reset_stream(s)
    s.accept_waveform(16000, np.zeros(PAD,np.float32))
    while k.is_ready(s):
        k.decode_stream(s); r = k.get_result(s)
        if r: n += 1; k.reset_stream(s)
    return n
if __name__ == "__main__":
    meta = json.load(open(CORP+"/aug_meta.json"))
    pos = [m for m in meta if m["kind"]=="pos" and m["slug"]=="rama-taraka-mantra" and m["cond"] in ("clean","snr10") and m["reps"]==1]
    neg = [m for m in meta if m["kind"]=="neg" and m["cond"]!="long" and m["cond"]!="noise"]
    sg = {m["file"]: segments(sf.read(f"{CORP}/{m['file']}",dtype="float32")[0]) for m in pos+neg}
    for boost,thr in itertools.product([2.0,4.0,6.0],[0.1,0.25,0.4]):
        hit = sum(any(spot("rama-taraka-mantra",boost,thr,s)>=1 for s in sg[m["file"]]) for m in pos)
        fa = sum(spot("rama-taraka-mantra",boost,thr,s) for m in neg for s in sg[m["file"]])
        print(f"boost {boost} thr {thr}: positives {hit}/{len(pos)}, false on {len(neg)} neg clips: {fa}", flush=True)
