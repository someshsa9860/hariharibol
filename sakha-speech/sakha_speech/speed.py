"""How long narration takes, so a job can say when it will finish.

Time is counted per character of spoken text, for each language and engine (Hindi in Devanagari is slower
than English, Parler is slower than Kokoro). A job learns from its own verses first; before it has made one,
the figure comes from earlier jobs (work/speed.json), and before any job from the voice test's timings.
"""

import json

from .config import Voice, work_dir


def rate_key(voice: Voice) -> str:
    return f"{voice.language}:{voice.engine}"


def _history_path():
    return work_dir() / "speed.json"


def _from_voice_test() -> dict[str, list[float]]:
    """[characters, seconds] per language and engine, from work/samples/<lang>/<voice>/info.json."""
    out: dict[str, list[float]] = {}
    for info_path in (work_dir() / "samples").glob("*/*/info.json"):
        try:
            info = json.loads(info_path.read_text(encoding="utf-8"))
            key = f"{info_path.parent.parent.name}:{info['engine']}"
            seen = out.setdefault(key, [0.0, 0.0])
            seen[0] += sum(len(line) for line in info["lines"])
            seen[1] += float(info["computeSeconds"])
        except (OSError, ValueError, KeyError):
            continue
    return out


def load_history() -> dict[str, list[float]]:
    path = _history_path()
    saved = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {**_from_voice_test(), **saved}


class Rates:
    """Seconds per character, learned as verses are made."""

    def __init__(self, history: dict[str, list[float]] | None = None, persist: bool = True):
        self.history = load_history() if history is None else history
        self.persist = persist
        self.session: dict[str, list[float]] = {}

    def observe(self, voice: Voice, chars: int, seconds: float) -> None:
        key = rate_key(voice)
        for book in (self.session, self.history):
            seen = book.setdefault(key, [0.0, 0.0])
            seen[0] += chars
            seen[1] += seconds
        if self.persist:
            path = _history_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            saved = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            saved[key] = self.history[key]
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(saved, indent=1), encoding="utf-8")
            tmp.replace(path)

    def rate(self, key: str) -> float | None:
        for book in (self.session, self.history):
            chars, seconds = book.get(key, (0, 0))
            if chars > 0 and seconds > 0:
                return seconds / chars
        return None

    def estimate(self, items) -> float | None:
        """Seconds to make `items` (anything with .voice and .chars), or None when nothing is known yet."""
        known = [r for r in (self.rate(k) for k in {rate_key(i.voice) for i in items}) if r]
        if not known:
            return None
        average = sum(known) / len(known)
        return sum(i.chars * (self.rate(rate_key(i.voice)) or average) for i in items)
