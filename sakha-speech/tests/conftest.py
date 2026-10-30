import json
import time

import pytest

from sakha_speech.config import Book, Voice
from sakha_speech.content import save_text
from sakha_speech.generate import make
from sakha_speech.manifest import Manifest
from sakha_speech.plan import build_plan

SLUG = "bhagavad-gita"


@pytest.fixture(autouse=True)
def work(tmp_path, monkeypatch):
    """Everything a run writes goes under tmp_path: text and manifests, the MP3s, the cast files."""
    monkeypatch.setenv("SAKHA_WORK_DIR", str(tmp_path / "work"))
    monkeypatch.setenv("SAKHA_AUDIO_DIR", str(tmp_path / "narration"))
    monkeypatch.setenv("SAKHA_CAST_DIR", str(tmp_path / "characters"))
    return tmp_path / "work"


@pytest.fixture
def voices():
    return {
        "en-fake-m": Voice("en-fake-m", "en", "male", "fake", "test"),
        "en-fake-f": Voice("en-fake-f", "en", "female", "fake", "test"),
        "en-fake-m2": Voice("en-fake-m2", "en", "male", "fake", "test", {"seed": 2}),
        "hi-fake-m": Voice("hi-fake-m", "hi", "male", "fake", "test"),
        "hi-fake-f": Voice("hi-fake-f", "hi", "female", "fake", "test", {"seed": 1}),
    }


@pytest.fixture
def book():
    return Book(SLUG, 1, ("meaning",), None, "json/bhagavat-gita",
                {"en": {"male": "en-fake-m", "female": "en-fake-f"}, "hi": {"male": "hi-fake-m", "female": "hi-fake-f"}})


@pytest.fixture
def cast_file(tmp_path):
    """A small cast: Krishna and Arjuna in chapter 1, a woman (Devi) in chapter 2, no one recorded for 1.1.3."""
    folder = tmp_path / "characters"
    folder.mkdir()
    (folder / f"{SLUG}.json").write_text(json.dumps({
        "book": SLUG,
        "characters": {
            "krishna": {"names": {"en": "Krishna", "hi": "कृष्ण"}, "gender": "male"},
            "arjuna": {"names": {"en": "Arjuna", "hi": "अर्जुन"}, "gender": "male"},
            "devi": {"names": {"en": "Devi"}, "gender": "female"},
        },
        "chapters": {"1": "Arjuna's despair", "2": "Sankhya"},
        "verses": {"1.1.1": "krishna", "1.1.2": "arjuna", "1.2.1": "devi"},
    }, ensure_ascii=False), encoding="utf-8")


@pytest.fixture
def texts():
    save_text(SLUG, "meaning", "en", {"1.1.1": "Krishna said: O Arjuna, rise.", "1.1.2": "Arjuna said: I will not fight.",
                                      "1.1.3": None, "1.2.1": "Devi said: be kind."})
    save_text(SLUG, "meaning", "hi", {"1.1.1": "कृष्ण ने कहा।", "1.1.2": "अर्जुन ने कहा।"})


@pytest.fixture
def config_files(tmp_path, monkeypatch):
    """Writes voices.yaml and books.yaml for the fake engine, and points the app at them: the worker process a
    test starts reads the same two files. `delay` makes every piece of speech take that many seconds."""
    def write(delay: float = 0):
        extra = f", delay: {delay}" if delay else ""
        (tmp_path / "voices.yaml").write_text(
            "voices:\n"
            f"  en-fake-m: {{language: en, gender: male, engine: fake, licence: test{extra}}}\n"
            f"  en-fake-f: {{language: en, gender: female, engine: fake, licence: test{extra}}}\n"
            f"  en-fake-m2: {{language: en, gender: male, engine: fake, licence: test, seed: 2{extra}}}\n"
            f"  hi-fake-m: {{language: hi, gender: male, engine: fake, licence: test{extra}}}\n"
            f"  hi-fake-f: {{language: hi, gender: female, engine: fake, licence: test{extra}}}\n")
        (tmp_path / "books.yaml").write_text(
            f"books:\n  {SLUG}:\n    bookNumber: 1\n    kinds: [meaning]\n    narrators:\n"
            "      en: {male: en-fake-m, female: en-fake-f}\n      hi: {male: hi-fake-m, female: hi-fake-f}\n")
        monkeypatch.setenv("SAKHA_VOICES_FILE", str(tmp_path / "voices.yaml"))
        monkeypatch.setenv("SAKHA_BOOKS_FILE", str(tmp_path / "books.yaml"))
    write()
    return write


@pytest.fixture
def make_all(book, voices):
    """Makes everything a plan still has to do, the way a job does, and returns the plan it made from."""
    def run(languages=("en",), **plan_args):
        plan = build_plan(book, voices, list(languages), **plan_args)
        manifests = {}
        for item in plan.todo:
            make(item, manifests.setdefault(item.language, Manifest(book.slug, item.language)))
        return plan
    return run


@pytest.fixture
def wait_for():
    """wait_for(condition, timeout): polls until `condition()` returns something truthy, and returns it."""
    def wait(condition, timeout=60.0, step=0.1):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            value = condition()
            if value:
                return value
            time.sleep(step)
        pytest.fail(f"gave up waiting after {timeout:.0f}s")
    return wait
