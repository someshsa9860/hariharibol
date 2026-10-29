import pytest

from sakha_speech.config import ConfigError, load_books, load_voices


def test_the_shipped_files_load_and_every_narrator_matches_its_voice():
    voices = load_voices()
    books = load_books(voices)
    gita = books["bhagavad-gita"]
    for language in ("en", "hi"):
        for gender in ("male", "female"):
            voice = voices[gita.narrator(language, gender)]
            assert (voice.language, voice.gender) == (language, gender)


def test_a_narrator_of_the_wrong_gender_is_refused(tmp_path):
    (tmp_path / "v.yaml").write_text("voices:\n  hi-x: {language: hi, gender: female, engine: fake}\n")
    (tmp_path / "b.yaml").write_text("books:\n  g: {bookNumber: 1, narrators: {hi: {male: hi-x}}}\n")
    with pytest.raises(ConfigError, match="female hi voice"):
        load_books(load_voices(tmp_path / "v.yaml"), tmp_path / "b.yaml")


def test_an_unknown_engine_is_refused(tmp_path):
    (tmp_path / "v.yaml").write_text("voices:\n  x: {language: en, gender: male, engine: siri}\n")
    with pytest.raises(ConfigError, match="engine"):
        load_voices(tmp_path / "v.yaml")


def test_a_voice_fingerprint_changes_with_its_settings(voices):
    from sakha_speech.config import Voice
    a = Voice("x", "hi", "male", "parler", "", {"seed": 1, "description": "calm"})
    b = Voice("x", "hi", "male", "parler", "", {"seed": 2, "description": "calm"})
    assert a.fingerprint() != b.fingerprint()
    assert a.fingerprint() == Voice("y", "hi", "male", "parler", "other licence", {"description": "calm", "seed": 1}).fingerprint()
