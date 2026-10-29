"""The voice test: the same lines in every voice of a language, and a page to compare them by ear.

work/samples/<lang>/<voice>/<n>.mp3 and work/samples/index.html (open it in a browser)."""

import html
import json

from . import audio
from .config import Book, Voice, load_lexicon, load_samples, work_dir
from .content import load_text
from .generate import speak
from .keys import sort_key
from .text import normalise


def sample_lines(language: str, books: dict[str, Book], extra_verses: int = 2) -> list[str]:
    lines = list(load_samples().get(language) or [])
    for book in books.values():
        for kind in book.kinds:
            texts = load_text(book.slug, kind, language)
            lines += [texts[v] for v in sorted(texts, key=sort_key) if texts[v]][:extra_verses]
    return lines


def make_samples(language: str, voices: list[Voice], books: dict[str, Book], log=print) -> None:
    lines = sample_lines(language, books)
    if not lines:
        raise RuntimeError(f"samples.yaml has no lines for '{language}'")
    lexicon = load_lexicon(language)
    for voice in voices:
        out = work_dir() / "samples" / language / voice.id
        audio_s = compute_s = 0.0
        for n, line in enumerate(lines, 1):
            spoken = speak(normalise(line, language, lexicon), voice)
            audio_s += audio.write_mp3(spoken.samples, spoken.sample_rate, out / f"{n}.mp3") / 1000
            compute_s += spoken.compute_seconds
        info = {"voice": voice.id, "gender": voice.gender, "engine": voice.engine, "licence": voice.licence,
                "lines": lines, "audioSeconds": round(audio_s, 1), "computeSeconds": round(compute_s, 1)}
        (out / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
        log(f"  {voice.id}: {audio_s:.0f}s of audio in {compute_s:.0f}s")
    page = write_index()
    log(f"open {page}")


def write_index():
    root = work_dir() / "samples"
    parts = ["<!doctype html><meta charset=utf-8><title>Sakha Speech voice test</title>",
             "<style>body{font:15px system-ui;max-width:900px;margin:24px auto;padding:0 16px}"
             "section{border-top:1px solid #ccc;padding:8px 0}audio{width:100%}p{margin:4px 0}"
             ".m{color:#666;font-size:13px}</style><h1>Voice test</h1>"]
    for lang_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        parts.append(f"<h2>{html.escape(lang_dir.name)}</h2>")
        for voice_dir in sorted(p for p in lang_dir.iterdir() if (p / "info.json").exists()):
            info = json.loads((voice_dir / "info.json").read_text(encoding="utf-8"))
            speed = info["computeSeconds"] / info["audioSeconds"] if info["audioSeconds"] else 0
            parts.append(f"<section><h3>{html.escape(info['voice'])}</h3><p class=m>{info['gender']}, {info['engine']}, "
                         f"{html.escape(info['licence'])}; {speed:.2f}s of work per second of audio</p>")
            for n, line in enumerate(info["lines"], 1):
                src = f"{lang_dir.name}/{voice_dir.name}/{n}.mp3"
                parts.append(f"<p>{html.escape(line)}</p><audio controls preload=none src='{src}'></audio>")
            parts.append("</section>")
    page = root / "index.html"
    page.write_text("\n".join(parts), encoding="utf-8")
    return page
