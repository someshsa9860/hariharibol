"""Makes the narration of one book, in one language, by its narrator of one gender."""

import time
from dataclasses import dataclass, field

import numpy as np

from . import audio
from .config import Book, Voice, load_lexicon
from .content import load_text
from .engines import engine_for
from .keys import narration_key, sort_key
from .manifest import Manifest, audio_path, fingerprint
from .text import normalise, split

RETRIES = 2  # extra takes for a piece that fails the checks, each with the next seed


@dataclass
class Spoken:
    samples: np.ndarray
    sample_rate: int
    problems: list = field(default_factory=list)
    compute_seconds: float = 0.0


def speak(text: str, voice: Voice, take: int = 0) -> Spoken:
    """Says already-normalised text: split, each piece checked and retried, then joined.
    `take` > 0 starts from other seeds, for a verse a person asked to have made again."""
    engine = engine_for(voice)
    started = time.monotonic()
    pieces, problems = [], []
    for piece, pause in split(text, engine.max_chars):
        for attempt in range(RETRIES + 1):
            samples = engine.synth(piece, voice, take * (RETRIES + 1) + attempt)
            problem = audio.check_piece(audio.trim(samples, engine.sample_rate), engine.sample_rate, piece)
            if not problem:
                break
        if problem:
            problems.append(f"{problem}: {piece[:60]}")
        pieces.append((samples, pause))
    return Spoken(audio.join(pieces, engine.sample_rate), engine.sample_rate, problems, time.monotonic() - started)


def in_chapter(verse_id: str, chapter: str | None) -> bool:
    """--chapter 2 (the Gita's chapter 2) or 1.3 (canto 1, chapter 3)."""
    if not chapter:
        return True
    return verse_id.split(".", 1)[1].startswith(f"{chapter}.")


@dataclass
class Summary:
    made: int = 0
    skipped: int = 0
    check: int = 0
    no_text: int = 0
    audio_seconds: float = 0.0
    compute_seconds: float = 0.0


def generate(book: Book, voices: dict[str, Voice], language: str, gender: str, kind: str = "meaning",
             chapter: str | None = None, limit: int | None = None, force: bool = False, log=print) -> Summary:
    voice = voices[book.narrator(language, gender)]
    texts = load_text(book.slug, kind, language)
    if not texts:
        raise RuntimeError(f"no {language} text for {book.slug} yet: run `sakha-speech fetch --book {book.slug} --lang {language}`")
    lexicon = load_lexicon(language)
    manifest = Manifest(book.slug, language, voice)
    summary = Summary()
    log(f"{book.slug} {language} {gender}: narrator {voice.id} ({voice.engine})")

    for vid in sorted(texts, key=sort_key):
        if not in_chapter(vid, chapter):
            continue
        if not texts[vid]:
            summary.no_text += 1
            continue
        spoken_text = normalise(texts[vid], language, lexicon)
        hash_ = fingerprint(spoken_text, voice)
        if not force and manifest.is_current(kind, vid, hash_):
            summary.skipped += 1
            continue
        if limit is not None and summary.made >= limit:
            break

        previous = manifest.get(kind, vid) or {}
        take = int(previous.get("take", 0))
        spoken = speak(spoken_text, voice, take)
        key = narration_key(book.slug, language, voice.id, vid, kind)
        duration_ms = audio.write_mp3(spoken.samples, spoken.sample_rate, audio_path(key))
        manifest.put(kind, vid, {
            "hash": hash_,
            "key": key,
            "durationMs": duration_ms,
            "status": "check" if spoken.problems else "ok",
            "problem": "; ".join(spoken.problems) or None,
            "uploadedHash": previous.get("uploadedHash"),
            "take": take,
        })
        manifest.save()

        summary.made += 1
        summary.check += bool(spoken.problems)
        summary.audio_seconds += duration_ms / 1000
        summary.compute_seconds += spoken.compute_seconds
        flag = "  CHECK " + "; ".join(spoken.problems) if spoken.problems else ""
        log(f"  {vid}  {duration_ms / 1000:5.1f}s audio in {spoken.compute_seconds:5.1f}s{flag}")

    if summary.audio_seconds:
        log(f"made {summary.made} ({summary.check} to check), skipped {summary.skipped} already made, "
            f"{summary.no_text} without text; {summary.compute_seconds / summary.audio_seconds:.2f}s of work per second of audio")
    else:
        log(f"nothing new: {summary.skipped} already made, {summary.no_text} without text")
    return summary
