import pytest

from sakha_speech.keys import chapter_id, narration_key, sort_key, verse_parts


def test_gita_files_are_book_language_chapter_verse():
    assert narration_key("bhagavad-gita", "hi", "1.2.47") == "bhagavad-gita/hi/2/47.mp3"


def test_a_verse_of_another_kind_keeps_the_kind_in_its_name():
    assert narration_key("bhagavad-gita", "en", "1.2.47", "purport") == "bhagavad-gita/en/2/47-purport.mp3"


def test_a_compound_verse_is_filed_under_its_first_number():
    assert verse_parts("1.1.16-18") == ["1", "16"]
    assert narration_key("bhagavad-gita", "en", "1.1.16-18") == "bhagavad-gita/en/1/16.mp3"


def test_a_book_with_cantos_keeps_the_canto():
    assert narration_key("srimad-bhagavatam", "en", "2.1.3.12") == "srimad-bhagavatam/en/1/3/12.mp3"


def test_no_voice_in_the_path_because_one_chapter_has_several():
    assert "fake" not in narration_key("bhagavad-gita", "en", "1.1.1")


def test_chapter_ids():
    assert chapter_id("1.2.47") == "2"
    assert chapter_id("2.1.3.12") == "1.3"


def test_reading_order():
    assert sorted(["1.2.10", "1.2.9", "1.1.16-18", "1.1.15"], key=sort_key) == ["1.1.15", "1.1.16-18", "1.2.9", "1.2.10"]


@pytest.mark.parametrize("bad", ["../etc", "1", "1.2.x", "1.2.3/4", ""])
def test_a_bad_id_is_refused(bad):
    with pytest.raises(ValueError):
        verse_parts(bad)
