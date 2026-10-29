"""What has been made for one narrator's book: work/manifest/<book>/<lang>/<voice>.json.

  {"voice": {...}, "items": {"meaning": {"1.2.47": {hash, key, durationMs, status, problem, uploadedHash}}}}

`hash` covers the spoken text, the voice's settings and the pipeline version, so a verse is made again
only when one of them changed. `status` is ok, check (a piece kept failing the checks; listen in
`review`) or approved (a person listened to a check and kept it). Saved after every verse, so a run that
is stopped loses at most the verse it was on.
"""

import hashlib
import json
from pathlib import Path

from . import PIPELINE_VERSION
from .config import Voice, work_dir


def fingerprint(spoken_text: str, voice: Voice) -> str:
    raw = f"{PIPELINE_VERSION}\n{voice.fingerprint()}\n{spoken_text}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def audio_path(key: str) -> Path:
    return work_dir() / "audio" / key


class Manifest:
    def __init__(self, book: str, language: str, voice: Voice):
        self.book, self.language, self.voice = book, language, voice
        self.path = work_dir() / "manifest" / book / language / f"{voice.id}.json"
        data = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {}
        self.items: dict[str, dict[str, dict]] = data.get("items") or {}

    def get(self, kind: str, verse_id: str) -> dict | None:
        return self.items.get(kind, {}).get(verse_id)

    def put(self, kind: str, verse_id: str, entry: dict):
        self.items.setdefault(kind, {})[verse_id] = entry

    def drop(self, kind: str, verse_id: str):
        self.items.get(kind, {}).pop(verse_id, None)

    def is_current(self, kind: str, verse_id: str, hash_: str) -> bool:
        entry = self.get(kind, verse_id)
        return bool(entry and entry.get("hash") == hash_ and audio_path(entry["key"]).exists())

    def voice_info(self) -> dict:
        v = self.voice
        return {"id": v.id, "language": v.language, "gender": v.gender, "engine": v.engine,
                "model": v.settings.get("model") or ("hexgrad/Kokoro-82M" if v.engine == "kokoro" else None),
                "licence": v.licence}

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"voice": self.voice_info(), "items": self.items}, ensure_ascii=False, indent=1),
                       encoding="utf-8")
        tmp.replace(self.path)
