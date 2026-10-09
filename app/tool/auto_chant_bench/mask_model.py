"""Make a Devanagari-only copy of the Omnilingual CTC model by pushing the final-layer bias of every other script's
tokens far below zero. usage: mask_model.py <in.onnx> <tokens.txt> <out.onnx>"""
import sys, onnx, numpy as np
from onnx import numpy_helper
src, tok, dst = sys.argv[1:4]
allowed = np.zeros(9812, bool); allowed[:5] = True   # <s> <pad> </s> <unk> and the space token
def ok(piece):
    body = piece.replace("▁", "")
    return all(0x0900 <= ord(c) <= 0x097F or c in "‌‍" for c in body)
for line in open(tok, encoding="utf-8"):
    piece, idx = line.rstrip("\n").rsplit(" ", 1); idx = int(idx)
    if ok(piece) and (piece.strip("▁") != "" or idx < 5): allowed[idx] = True
print("allowed", int(allowed.sum()), "of", len(allowed))
m = onnx.load(src)
for init in m.graph.initializer:
    if init.name == "model.final_proj.bias":
        b = numpy_helper.to_array(init).copy(); b[~allowed] = -1000.0
        init.CopyFrom(numpy_helper.from_array(b, init.name)); break
else: raise SystemExit("bias not found")
onnx.save(m, dst)
