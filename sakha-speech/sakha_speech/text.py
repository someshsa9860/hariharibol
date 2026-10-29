"""Turns a verse's meaning into pieces a voice can say well: speakable spelling, then short sentences."""

import re
import unicodedata

# Romanised Sanskrit (IAST) to the spelling an English voice reads correctly. Kṛṣṇa -> Krishna.
_IAST = {
    "ā": "a", "ī": "i", "ū": "u", "ṛ": "ri", "ṝ": "ri", "ḷ": "l", "ḹ": "l",
    "ṅ": "n", "ñ": "n", "ṭ": "t", "ḍ": "d", "ṇ": "n", "ś": "sh", "ṣ": "sh",
    "ḥ": "h", "ṁ": "m", "ṃ": "m", "ē": "e", "ō": "o",
}
_IAST.update({k.upper(): v.capitalize() for k, v in list(_IAST.items())})

# Pause after a piece, in milliseconds, by how it ended.
SENTENCE_PAUSE = 450
CLAUSE_PAUSE = 220

# . ? ! and the Devanagari danda (।) end a sentence.
_SENTENCE_END = r"(?<=[.?!।])\s+|(?<=।)(?=\S)"


def _strip_iast(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    return "".join(_IAST.get(ch, ch) for ch in text)


def _apply_lexicon(text: str, lexicon: dict[str, str]) -> str:
    for word, said in lexicon.items():
        text = re.sub(rf"(?<!\w){re.escape(word)}(?!\w)", said, text, flags=re.IGNORECASE)
    return text


def _verse_refs(text: str, language: str) -> str:
    # "2.47" or "1.16-18" read as numbers joined by "chapter ... verse ..." in English; Hindi keeps them.
    if language != "en":
        return text
    return re.sub(r"\b(\d+)\.(\d+)(?:-(\d+))?\b", lambda m: f"chapter {m[1]}, verse {m[2]}" + (f" to {m[3]}" if m[3] else ""), text)


def normalise(text: str, language: str, lexicon: dict[str, str] | None = None) -> str:
    """Speakable text. The same input always gives the same output, so it can be hashed."""
    text = unicodedata.normalize("NFC", text or "")
    if language == "en":
        text = _strip_iast(text)
    text = _verse_refs(text, language)
    text = _apply_lexicon(text, lexicon or {})
    text = text.replace("—", ", ").replace("–", ", ").replace("…", ".")
    text = re.sub(r"[\"“”‘’`*_]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Double danda reads the same as a single one.
    text = text.replace("॥", "।")
    return text


def _split_long(sentence: str, max_chars: int) -> list[str]:
    """Breaks a sentence that is too long at commas and semicolons, then at spaces if it must."""
    if len(sentence) <= max_chars:
        return [sentence]
    parts, current = [], ""
    for clause in re.split(r"(?<=[,;:])\s+", sentence):
        if current and len(current) + 1 + len(clause) > max_chars:
            parts.append(current)
            current = clause
        else:
            current = f"{current} {clause}".strip()
    if current:
        parts.append(current)
    out = []
    for part in parts:
        while len(part) > max_chars:
            cut = part.rfind(" ", 0, max_chars)
            cut = cut if cut > max_chars // 2 else max_chars
            out.append(part[:cut].strip())
            part = part[cut:].strip()
        if part:
            out.append(part)
    return out


def split(text: str, max_chars: int = 220) -> list[tuple[str, int]]:
    """Pieces of at most max_chars, each with the pause that should follow it."""
    pieces = []
    for sentence in re.split(_SENTENCE_END, text):
        sentence = sentence.strip()
        if not sentence:
            continue
        chunks = _split_long(sentence, max_chars)
        for i, chunk in enumerate(chunks):
            pieces.append((chunk, SENTENCE_PAUSE if i == len(chunks) - 1 else CLAUSE_PAUSE))
    if pieces:
        pieces[-1] = (pieces[-1][0], 0)
    return pieces
