"""The voice test: the same lines in every voice of a language, and a page to compare them by ear.

work/samples/<lang>/<voice>/<n>.mp3 and work/samples/index.html (open it in a browser). The studio shows the
same files as each voice's demo."""

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
    if extra_verses:
        for book in books.values():
            for kind in book.kinds:
                texts = load_text(book.slug, kind, language)
                lines += [texts[v] for v in sorted(texts, key=sort_key) if texts[v]][:extra_verses]
    return lines


def sample_dir(language: str, voice_id: str):
    return work_dir() / "samples" / language / voice_id


def make_sample(language: str, voice: Voice, lines: list[str], stop=None, step=None) -> dict:
    """Speaks `lines` in `voice` into work/samples and returns what was written to its info.json.
    `step(n, characters, seconds)` is told after each line is done; `stop` is as for `speak`."""
    lexicon = load_lexicon(language)
    out = sample_dir(language, voice.id)
    audio_s = compute_s = 0.0
    for n, line in enumerate(lines, 1):
        text = normalise(line, language, lexicon)
        spoken = speak(text, voice, stop=stop)
        audio_s += audio.write_mp3(spoken.samples, spoken.sample_rate, out / f"{n}.mp3") / 1000
        compute_s += spoken.compute_seconds
        if step:
            step(n, len(text), spoken.compute_seconds)
    info = {"voice": voice.id, "gender": voice.gender, "engine": voice.engine, "licence": voice.licence,
            "fingerprint": voice.fingerprint(), "lines": lines,
            "audioSeconds": round(audio_s, 1), "computeSeconds": round(compute_s, 1)}
    (out / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    return info


def make_samples(language: str, voices: list[Voice], books: dict[str, Book], log=print) -> None:
    lines = sample_lines(language, books)
    if not lines:
        raise RuntimeError(f"samples.yaml has no lines for '{language}'")
    for voice in voices:
        info = make_sample(language, voice, lines)
        log(f"  {voice.id}: {info['audioSeconds']:.0f}s of audio in {info['computeSeconds']:.0f}s")
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
