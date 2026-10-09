"""Folds Devanagari (plus the Bengali/Arabic letters an unconstrained multilingual CTC leaks) to Roman sounds,
then the app's own fold(). One alphabet for every script, so Roman backend phrases and Devanagari ones compare."""
from lib import fold
C = dict(zip("कखगघङचछजझञटठडढणतथदधनपफबभमयरलळवशषसह",
 ["k","kh","g","gh","n","c","ch","j","jh","n","t","th","d","dh","n","t","th","d","dh","n","p","ph","b","bh","m","y","r","l","l","v","sh","sh","s","h"]))
C.update({"क़":"k","ख़":"kh","ग़":"g","ज़":"z","ड़":"r","ढ़":"rh","फ़":"f","य़":"y"})
IV = dict(zip("अआइईउऊऋएऐओऔऍऑ",["a","a","i","i","u","u","ri","e","ai","o","au","e","o"])); IV["ॐ"]="om"
MATRA = dict(zip("ािीुूृेैोौॅॉ",["a","i","i","u","u","ri","e","ai","o","au","e","o"]))
AR = dict(zip("رمنجايشسكکلبتدهحزقفعطصضذثخغوی",["r","m","n","j","a","y","sh","s","k","k","l","b","t","d","h","h","z","k","f","a","t","s","d","z","s","kh","g","v","y"]))
def to_dev(ch):  # every Indic block (Bengali..Malayalam) -> Devanagari: they share one code-point layout
    o = ord(ch)
    if 0x0980 <= o <= 0x0D7F:
        base = o & ~0x7F; r = o - (base - 0x0900)
        return chr(r) if 0x0900 <= r <= 0x097F else ch
    return ch
def roman(text):
    out=[]; pend=False
    def flush(final=False):
        nonlocal pend
        if pend and not final: out.append("a")
        pend=False
    for ch in text:
        ch = to_dev(ch)
        if ch in C: flush(); out.append(C[ch]); pend=True
        elif ch in MATRA: pend=False; out.append(MATRA[ch])
        elif ch == "्": pend=False
        elif ch in IV: flush(); out.append(IV[ch])
        elif ch in "ंँ": flush(); out.append("m")
        elif ch == "ः": flush(); out.append("h")
        elif ch == "़": pass
        elif ch in AR: flush(); out.append(AR[ch]); 
        else:
            flush(final=not (ch.isascii() and ch.isalpha() or ord(ch) >= 0xC0))
            out.append(ch)
    flush(final=True)
    return "".join(out)
def fold2(text): return fold(roman(text))
if __name__ == "__main__":
    for s in ["श्री राम जय राम जय जय राम","शीरान जा रान जा় जा राম","ॐ नमः शिवाय","SHREE RAM JAI RAM","Sri Rama Jaya Rama Jaya Jaya Rama","شرी رाمजाए رाمजيजए رام"]: print(s,"->",fold2(s))
