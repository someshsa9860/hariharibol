from sakha_speech.content import save_text
from sakha_speech.manifest import Manifest
from sakha_speech.plan import build_plan


def by_verse(plan, language="en"):
    return {i.verse_id: i for i in plan.items if i.language == language}


def test_a_plan_lists_each_verse_with_text_in_reading_order_with_its_voice(book, voices, cast_file, texts):
    plan = build_plan(book, voices, ["en", "hi"])
    assert [(i.language, i.verse_id) for i in plan.items] == [
        ("en", "1.1.1"), ("en", "1.1.2"), ("en", "1.2.1"), ("hi", "1.1.1"), ("hi", "1.1.2")]
    en = by_verse(plan)
    assert (en["1.1.1"].character, en["1.1.1"].voice.id, en["1.1.1"].chapter) == ("krishna", "en-fake-m", "1")
    assert (en["1.2.1"].character, en["1.2.1"].voice.id, en["1.2.1"].chapter) == ("devi", "en-fake-f", "2")
    assert en["1.1.1"].key == "bhagavad-gita/en/1/1.mp3"
    assert plan.no_text == {"en": 1, "hi": 0}  # 1.1.3 has no English text
    assert plan.missing == []


def test_a_language_whose_text_was_never_fetched_is_reported_not_planned(book, voices, cast_file, texts):
    plan = build_plan(book, voices, ["en", "ta"])
    assert plan.missing == ["ta"]
    assert {i.language for i in plan.items} == {"en"}


def test_chapters_narrow_the_plan(book, voices, cast_file, texts):
    assert set(by_verse(build_plan(book, voices, ["en"], chapters=["2"]))) == {"1.2.1"}


def test_the_spoken_text_is_the_normalised_one(book, voices, cast_file, texts):
    assert by_verse(build_plan(book, voices, ["en"]))["1.1.1"].spoken == "Krishna said: O Arjuna, rise."
    save_text(book.slug, "meaning", "en", {"1.1.1": "Kṛṣṇa said: rise."})
    assert by_verse(build_plan(book, voices, ["en"]))["1.1.1"].spoken == "Krishna said: rise."


def test_made_verses_are_done_and_a_second_plan_has_nothing_to_do(book, voices, cast_file, texts, make_all):
    assert len(make_all(["en", "hi"]).todo) == 5
    again = build_plan(book, voices, ["en", "hi"])
    assert again.todo == [] and all(i.done for i in again.items)


def test_force_plans_everything_again(book, voices, cast_file, texts, make_all):
    make_all(["en"])
    assert len(build_plan(book, voices, ["en"], force=True).todo) == 3


def test_a_missing_file_makes_the_verse_new_again(book, voices, cast_file, texts, make_all):
    make_all(["en"])
    from sakha_speech.manifest import audio_path
    audio_path("bhagavad-gita/en/1/2.mp3").unlink()
    assert [i.verse_id for i in build_plan(book, voices, ["en"]).todo] == ["1.1.2"]


def test_changed_text_makes_only_that_verse_new(book, voices, cast_file, texts, make_all):
    make_all(["en"])
    save_text(book.slug, "meaning", "en", {"1.1.1": "Krishna said: changed.", "1.1.2": "Arjuna said: I will not fight.",
                                           "1.1.3": None, "1.2.1": "Devi said: be kind."})
    assert [i.verse_id for i in build_plan(book, voices, ["en"]).todo] == ["1.1.1"]


def test_giving_one_character_another_voice_makes_only_that_characters_verses_new(book, voices, cast_file, texts, make_all):
    from sakha_speech.cast import save_choices
    make_all(["en", "hi"])
    save_choices(book.slug, {"en": {"krishna": "en-fake-m2"}})
    todo = build_plan(book, voices, ["en", "hi"]).todo
    assert [(i.language, i.verse_id, i.voice.id) for i in todo] == [("en", "1.1.1", "en-fake-m2")]


def test_choosing_the_voice_a_character_already_has_by_default_changes_nothing(book, voices, cast_file, texts, make_all):
    from sakha_speech.cast import save_choices
    make_all(["en"])
    save_choices(book.slug, {"en": {"krishna": "en-fake-m"}})  # the narrator's voice for a man, which he was reading with
    plan = build_plan(book, voices, ["en"])
    assert plan.todo == [] and by_verse(plan)["1.1.1"].default_voice is False


def test_a_voice_setting_that_changes_the_sound_makes_the_verses_new(book, voices, cast_file, texts, make_all):
    from sakha_speech.config import Voice
    make_all(["en"])
    voices["en-fake-m"] = Voice("en-fake-m", "en", "male", "fake", "test", {"seed": 9})
    assert {i.verse_id for i in build_plan(book, voices, ["en"]).todo} == {"1.1.1", "1.1.2"}  # Devi keeps her own voice


def test_the_status_of_an_earlier_take_is_carried_into_the_plan(book, voices, cast_file, texts, make_all):
    make_all(["en"])
    manifest = Manifest(book.slug, "en")
    manifest.get("meaning", "1.1.2")["status"] = "check"
    manifest.save()
    assert by_verse(build_plan(book, voices, ["en"]))["1.1.2"].status == "check"
