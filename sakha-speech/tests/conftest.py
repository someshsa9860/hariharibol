import pytest

from sakha_speech.config import Book, Voice


@pytest.fixture(autouse=True)
def work(tmp_path, monkeypatch):
    monkeypatch.setenv("SAKHA_WORK_DIR", str(tmp_path / "work"))
    return tmp_path / "work"


@pytest.fixture
def voices():
    return {
        "en-fake-m": Voice("en-fake-m", "en", "male", "fake", "test"),
        "en-fake-f": Voice("en-fake-f", "en", "female", "fake", "test"),
        "hi-fake-f": Voice("hi-fake-f", "hi", "female", "fake", "test", {"seed": 1}),
    }


@pytest.fixture
def book():
    return Book("bhagavad-gita", 1, ("meaning",), None, "json/bhagavat-gita",
                {"en": {"male": "en-fake-m", "female": "en-fake-f"}, "hi": {"female": "hi-fake-f"}})
