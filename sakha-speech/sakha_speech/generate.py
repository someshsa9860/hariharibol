"""Makes one verse's narration: speak it, check it, write the MP3, record it in the manifest.

Which verses to make, in which voices, and the loop over them are `plan.py` and `jobs.py`."""

import time
from dataclasses import dataclass, field

import numpy as np

from . import Stopped, audio
from .config import Voice
from .engines import engine_for
from .manifest import Manifest, audio_path
from .text import split

RETRIES = 2  # extra takes for a piece that fails the checks, each with the next seed


@dataclass
class Spoken:
    samples: np.ndarray
    sample_rate: int
    problems: list = field(default_factory=list)
    compute_seconds: float = 0.0


def speak(text: str, voice: Voice, take: int = 0, stop=None) -> Spoken:
    """Says already-normalised text: split, each piece checked and retried, then joined.
    `take` > 0 starts from other seeds, for a verse a person asked to have made again.
    `stop` is called before every piece; when it says True the verse is dropped with Stopped."""
    engine = engine_for(voice)
    started = time.monotonic()
    pieces, problems = [], []
    for piece, pause in split(text, engine.max_chars):
        for attempt in range(RETRIES + 1):
            if stop and stop():
                raise Stopped()
            samples = engine.synth(piece, voice, take * (RETRIES + 1) + attempt)
            problem = audio.check_piece(audio.trim(samples, engine.sample_rate), engine.sample_rate, piece)
            if not problem:
                break
        if problem:
            problems.append(f"{problem}: {piece[:60]}")
        pieces.append((samples, pause))
    return Spoken(audio.join(pieces, engine.sample_rate), engine.sample_rate, problems, time.monotonic() - started)


@dataclass
class Made:
    duration_ms: int
    compute_seconds: float
    problems: list


def make(item, manifest: Manifest, stop=None) -> Made:
    """Speaks `item` (a plan.Item) and records it. The manifest is saved before this returns, so a job that
    is stopped or killed afterwards loses nothing; the MP3 is written to a temporary name first, so one
    killed mid-write leaves no broken file."""
    previous = manifest.get(item.kind, item.verse_id) or {}
    take = int(previous.get("take", 0))
    spoken = speak(item.spoken, item.voice, take, stop)
    duration_ms = audio.write_mp3(spoken.samples, spoken.sample_rate, audio_path(item.key))
    manifest.put(item.kind, item.verse_id, {
        "hash": item.hash,
        "key": item.key,
        "voice": item.voice.id,
        "character": item.character,
        "durationMs": duration_ms,
        "status": "check" if spoken.problems else "ok",
        "problem": "; ".join(spoken.problems) or None,
        "uploadedHash": previous.get("uploadedHash"),
        "take": take,
    })
    manifest.save()
    return Made(duration_ms, spoken.compute_seconds, spoken.problems)
