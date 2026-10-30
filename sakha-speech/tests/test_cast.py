import json

import pytest

from sakha_speech import config
from sakha_speech.cast import NARRATOR, default_voice, load_cast, load_choices, resolve_voice, save_choices
from sakha_speech.config import ConfigError
from sakha_speech.keys import chapter_id, verse_parts


def test_a_book_without_a_cast_has_one_narrator_who_speaks_everything(book):
    cast = load_cast(book.slug)
    assert cast.speaker("1.1.1") == NARRATOR
    assert cast.character(NARRATOR).name("hi") == "Narrator"


def test_the_cast_says_who_speaks_each_verse(cast_file, book):
    cast = load_cast(book.slug)
    assert [cast.speaker(v) for v in ("1.1.1", "1.1.2", "1.2.1", "1.1.3")] == ["krishna", "arjuna", "devi", NARRATOR]
    assert cast.character("krishna").name("hi") == "कृष्ण"
    assert cast.character("devi").name("hi") == "Devi"  # no Hindi name: falls back to English
    assert cast.chapters["2"] == "Sankhya"


def test_an_unchosen_character_takes_the_narrator_of_the_same_gender(book, voices, cast_file):
    cast = load_cast(book.slug)
    assert resolve_voice(book, voices, cast, {}, "en", "krishna") == (voices["en-fake-m"], True)
    assert resolve_voice(book, voices, cast, {}, "en", "devi") == (voices["en-fake-f"], True)
    assert resolve_voice(book, voices, cast, {}, "hi", "devi") == (voices["hi-fake-f"], True)


def test_a_chosen_voice_wins_but_only_in_its_own_language(book, voices, cast_file):
    cast = load_cast(book.slug)
    choices = {"en": {"krishna": "en-fake-m2"}, "hi": {"krishna": "en-fake-f"}}  # the Hindi choice is a bad one
    assert resolve_voice(book, voices, cast, choices, "en", "krishna") == (voices["en-fake-m2"], False)
    assert resolve_voice(book, voices, cast, choices, "hi", "krishna") == (voices["hi-fake-m"], True)


def test_the_default_voice_falls_back_to_the_other_gender_then_to_any_voice_of_the_language(book, voices):
    only_male = {k: v for k, v in voices.items() if k != "en-fake-f"}
    assert default_voice(book, only_male, "en", "female").id == "en-fake-m"
    nobody = {k: v for k, v in voices.items() if v.language == "en"}
    with pytest.raises(ConfigError, match="no voice for 'hi'"):
        default_voice(book, nobody, "hi", "male")


def test_choices_are_saved_sorted_and_read_back(book):
    assert load_choices(book.slug) == {}
    save_choices(book.slug, {"hi": {"krishna": "hi-fake-m"}, "en": {"krishna": "en-fake-m2", "arjuna": "en-fake-m"}})
    assert load_choices(book.slug) == {"en": {"arjuna": "en-fake-m", "krishna": "en-fake-m2"}, "hi": {"krishna": "hi-fake-m"}}
    assert not list(config.cast_dir().glob("*.tmp"))


def test_the_shipped_gita_cast_is_whole(monkeypatch):
    monkeypatch.setenv("SAKHA_CAST_DIR", str(config.ROOT / "characters"))
    cast = load_cast("bhagavad-gita")
    assert len(cast.chapters) == 18
    assert len(cast.verses) == 701
    for verse_id, who in cast.verses.items():
        assert who in cast.characters, f"{verse_id} is spoken by {who}, who is not in the cast"
        assert verse_parts(verse_id)  # a well-formed id
        assert chapter_id(verse_id) in cast.chapters
    assert {c.gender for c in cast.characters.values()} <= {"male", "female"}
    data = json.loads((config.ROOT / "characters" / "bhagavad-gita.json").read_text(encoding="utf-8"))
    assert set(data["characters"]) == set(cast.characters)
