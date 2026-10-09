import sys, json, itertools, numpy as np, soundfile as sf, sherpa_onnx, sentencepiece as spm, tempfile, os
from lib import *
from run_baseline import d as KWS, transcribe
sp = spm.SentencePieceProcessor(model_file=KWS+"/bpe.model")
BPE_VOCAB = os.path.join(W, "bpe.vocab")  # sherpa wants a text vocab; the archive only has bpe.model
open(BPE_VOCAB, "w").write("".join(f"{sp.id_to_piece(i)}\t{sp.get_score(i)}\n" for i in range(sp.get_piece_size())))
print(sp.encode("SHREE RAM JAI RAM JAI JAI RAM", out_type=str))
def mk(score, paths, hotfile):
    return sherpa_onnx.OnlineRecognizer.from_transducer(tokens=KWS+"/tokens.txt",
      encoder=KWS+"/encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",decoder=KWS+"/decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
      joiner=KWS+"/joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",num_threads=1,decoding_method="modified_beam_search",
      max_active_paths=paths,hotwords_file=hotfile,hotwords_score=score,modeling_unit="bpe",bpe_vocab=BPE_VOCAB)
if __name__=="__main__":
  pass
if __name__=='__main__':
    meta=json.load(open(CORP+"/aug_meta.json"))
    sel=[m for m in meta if m["kind"]=="pos" and m["reps"]==1 and m["cond"]=="clean" and m["slug"]=="rama-taraka-mantra"]
    segs={m["file"]:segments(sf.read(f"{CORP}/{m['file']}",dtype="float32")[0]) for m in sel}
    M_=Matcher(MANTRAS["rama-taraka-mantra"][1])
    hot=tempfile.mktemp(); open(hot,"w").write("\n".join(["SHREE RAM JAI RAM JAI JAI RAM","SREE RAMA JAYA RAMA JAYA JAYA RAMA"])+"\n")
    for score,paths in itertools.product([1.5,3.0,5.0],[4,8]):
        r=mk(score,paths,hot); rs=[]
        for f,ss in segs.items():
            for s in ss:
                txt,_=transcribe(r,s); rs.append((M_.closest(txt),txt))
        print(f"score={score} paths={paths} mean={np.mean([a for a,_ in rs]):.2f} ge50={sum(a>=.5 for a,_ in rs)}/{len(rs)}  e.g. {rs[4][1]!r}")
