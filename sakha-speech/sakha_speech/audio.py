"""Joins the spoken pieces of a verse, checks them, and writes one evenly loud MP3 with ffmpeg."""

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

# EBU R128 loudness most podcast and streaming apps use; every file plays at the same volume.
LOUDNESS = "loudnorm=I=-16:TP=-1.5:LRA=11"
BITRATE = "64k"
OUT_RATE = 44100

# How long a piece may take per character before it is suspicious (seconds). Generous on purpose:
# Hindi in Devanagari is denser than English, and a slow devotional voice is slow.
MIN_SEC_PER_CHAR = 0.025
MAX_SEC_PER_CHAR = 0.25
SILENCE = 0.01  # peak below this is silence


class FfmpegMissing(RuntimeError):
    pass


def trim(samples: np.ndarray, sample_rate: int, threshold: float = SILENCE, keep_ms: int = 60) -> np.ndarray:
    """Cuts silence off both ends, leaving a few milliseconds so words are not clipped."""
    loud = np.flatnonzero(np.abs(samples) > threshold)
    if loud.size == 0:
        return samples[:0]
    keep = int(sample_rate * keep_ms / 1000)
    return samples[max(0, loud[0] - keep): loud[-1] + keep + 1]


def check_piece(samples: np.ndarray, sample_rate: int, text: str) -> str | None:
    """A reason the piece sounds wrong, or None. Catches silence, cut-offs and runaway babble."""
    if samples.size == 0 or float(np.max(np.abs(samples))) < SILENCE:
        return "silent"
    seconds = samples.size / sample_rate
    chars = max(1, len(text))
    if seconds < chars * MIN_SEC_PER_CHAR:
        return f"too short ({seconds:.1f}s for {chars} characters)"
    if seconds > chars * MAX_SEC_PER_CHAR + 1.0:
        return f"too long ({seconds:.1f}s for {chars} characters)"
    return None


def join(pieces: list[tuple[np.ndarray, int]], sample_rate: int) -> np.ndarray:
    """Each piece trimmed, followed by its pause in milliseconds."""
    out = []
    for samples, pause_ms in pieces:
        out.append(trim(samples, sample_rate))
        if pause_ms:
            out.append(np.zeros(int(sample_rate * pause_ms / 1000), dtype=np.float32))
    return np.concatenate(out).astype(np.float32) if out else np.zeros(0, dtype=np.float32)


def write_mp3(samples: np.ndarray, sample_rate: int, path: Path) -> int:
    """Writes the MP3 (mono, 64 kbps, loudness-normalised) and returns its length in milliseconds."""
    if not shutil.which("ffmpeg"):
        raise FfmpegMissing("ffmpeg is not installed; run ./setup.sh")
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        sf.write(wav.name, samples, sample_rate, subtype="FLOAT")
        tmp = path.with_suffix(".part.mp3")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav.name,
             "-af", LOUDNESS, "-ac", "1", "-ar", str(OUT_RATE), "-b:a", BITRATE, str(tmp)],
            check=True,
        )
        tmp.replace(path)
    return int(round(samples.size / sample_rate * 1000))
