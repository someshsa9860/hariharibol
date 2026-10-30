"""Reads voices.yaml, books.yaml, the lexicons and .env. Everything a run needs to know lives there."""

import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
GENDERS = ("male", "female")
ENGINES = ("kokoro", "parler", "fake")


class ConfigError(Exception):
    """A config file says something that cannot work. The message says which file and what."""


def load_env():
    """Loads .env beside the project, if there is one. Real environment variables win."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(ROOT / ".env", override=False)


def work_dir() -> Path:
    return Path(os.environ.get("SAKHA_WORK_DIR") or ROOT / "work")


def audio_dir() -> Path:
    """The finished narration, laid out exactly as it will be in S3 under the prefix: <book>/<lang>/..."""
    return Path(os.environ.get("SAKHA_AUDIO_DIR") or ROOT / "narration")


def cast_dir() -> Path:
    """Who speaks each verse, and the voice each character was given: <book>.json and <book>.voices.json."""
    return Path(os.environ.get("SAKHA_CAST_DIR") or ROOT / "characters")


def api_base() -> str:
    return (os.environ.get("SAKHA_API_BASE") or "https://api.hariharibol.com").rstrip("/")


def s3_settings() -> dict:
    return {
        "bucket": os.environ.get("S3_BUCKET") or "hariharibol-media",
        "region": os.environ.get("AWS_REGION") or "ap-south-1",
        "prefix": (os.environ.get("S3_NARRATION_PREFIX") or "narration").strip("/"),
    }


@dataclass(frozen=True)
class Voice:
    id: str
    language: str
    gender: str
    engine: str
    licence: str
    settings: dict = field(default_factory=dict)

    def fingerprint(self) -> str:
        """Changes whenever anything that affects how this voice sounds changes."""
        raw = json.dumps({"engine": self.engine, **self.settings}, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]


@dataclass(frozen=True)
class Book:
    slug: str
    book_number: int
    kinds: tuple
    translator: str | None
    s3_text: str | None
    narrators: dict  # language -> gender -> voice id

    def narrator(self, language: str, gender: str) -> str:
        try:
            return self.narrators[language][gender]
        except KeyError:
            raise ConfigError(f"books.yaml: {self.slug} has no {gender} narrator for '{language}'") from None

    def languages(self) -> list[str]:
        return list(self.narrators)


def _read_yaml(path: Path) -> dict:
    if not path.exists():
        raise ConfigError(f"{path.name} is missing")
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_voices(path: Path | None = None) -> dict[str, Voice]:
    data = _read_yaml(path or Path(os.environ.get("SAKHA_VOICES_FILE") or ROOT / "voices.yaml")).get("voices") or {}
    voices = {}
    for vid, entry in data.items():
        entry = dict(entry or {})
        language, gender, engine = entry.pop("language", None), entry.pop("gender", None), entry.pop("engine", None)
        licence = entry.pop("licence", "")
        if not language:
            raise ConfigError(f"voices.yaml: {vid} has no language")
        if gender not in GENDERS:
            raise ConfigError(f"voices.yaml: {vid} gender must be male or female, not {gender!r}")
        if engine not in ENGINES:
            raise ConfigError(f"voices.yaml: {vid} engine must be one of {', '.join(ENGINES)}, not {engine!r}")
        voices[vid] = Voice(vid, language, gender, engine, licence, entry)
    return voices


def load_books(voices: dict[str, Voice], path: Path | None = None) -> dict[str, Book]:
    data = _read_yaml(path or Path(os.environ.get("SAKHA_BOOKS_FILE") or ROOT / "books.yaml")).get("books") or {}
    books = {}
    for slug, entry in data.items():
        narrators = entry.get("narrators") or {}
        for language, by_gender in narrators.items():
            for gender, vid in (by_gender or {}).items():
                voice = voices.get(vid)
                if voice is None:
                    raise ConfigError(f"books.yaml: {slug} {language} {gender} names voice {vid!r}, not in voices.yaml")
                if (voice.language, voice.gender) != (language, gender):
                    raise ConfigError(
                        f"books.yaml: {slug} {language} {gender} names {vid}, which is a {voice.gender} {voice.language} voice"
                    )
        books[slug] = Book(
            slug=slug,
            book_number=int(entry["bookNumber"]),
            kinds=tuple(entry.get("kinds") or ["meaning"]),
            translator=entry.get("translator"),
            s3_text=entry.get("s3Text"),
            narrators=narrators,
        )
    return books


def load_lexicon(language: str) -> dict[str, str]:
    path = ROOT / "lexicon" / f"{language}.yaml"
    if not path.exists():
        return {}
    return {str(k): str(v) for k, v in (_read_yaml(path) or {}).items()}


def load_samples() -> dict[str, list[str]]:
    return _read_yaml(ROOT / "samples.yaml")
