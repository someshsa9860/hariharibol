import pytest

from sakha_speech.keys import narration_key, sort_key, verse_parts


def test_gita_keys_match_the_recitation_layout():
    assert narration_key("bhagavad-gita", "hi", "hi-parler-divya", "1.2.47", "meaning") == \
        "bhagavad-gita/hi/hi-parler-divya/2/47-meaning.mp3"


def test_a_compound_verse_is_filed_under_its_first_number():
    assert verse_parts("1.1.16-18") == ["1", "16"]


def test_a_book_with_cantos_keeps_the_canto():
    assert narration_key("srimad-bhagavatam", "en", "v", "2.1.3.12", "meaning") == "srimad-bhagavatam/en/v/1/3/12-meaning.mp3"


def test_reading_order():
    assert sorted(["1.2.10", "1.2.9", "1.1.16-18", "1.1.15"], key=sort_key) == ["1.1.15", "1.1.16-18", "1.2.9", "1.2.10"]


def test_a_bad_id_is_refused():
    with pytest.raises(ValueError):
        verse_parts("../etc")
