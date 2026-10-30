import numpy as np
import pytest

from sakha_speech import Stopped, audio
from sakha_speech.config import Voice
from sakha_speech.generate import make, speak
from sakha_speech.manifest import Manifest, audio_path
from sakha_speech.plan import build_plan


def test_make_writes_the_mp3_where_the_layout_says_and_records_it(book, voices, cast_file, texts):
    item = build_plan(book, voices, ["en"]).items[0]
    manifest = Manifest(book.slug, "en")
    made = make(item, manifest)
    assert item.key == "bhagavad-gita/en/1/1.mp3"
    path = audio_path(item.key)
    assert path.read_bytes()[:3] in (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    assert made.duration_ms > 1000
    entry = Manifest(book.slug, "en").get("meaning", "1.1.1")  # read back from disk: saved before make returned
    assert (entry["voice"], entry["character"], entry["status"]) == ("en-fake-m", "krishna", "ok")
    assert entry["hash"] == item.hash and entry["key"] == item.key
    assert not list(path.parent.glob("*.part*"))


def test_a_stop_before_the_first_piece_makes_nothing(book, voices, cast_file, texts):
    item = build_plan(book, voices, ["en"]).items[0]
    manifest = Manifest(book.slug, "en")
    with pytest.raises(Stopped):
        make(item, manifest, stop=lambda: True)
    assert not audio_path(item.key).exists()
    assert Manifest(book.slug, "en").get("meaning", "1.1.1") is None


def test_a_stop_part_way_through_a_verse_drops_that_verse(voices):
    calls = iter([False, False, True])
    long_text = "One sentence here. Another sentence there. A third sentence follows. " * 6
    with pytest.raises(Stopped):
        speak(long_text, voices["en-fake-m"], stop=lambda: next(calls))


def test_speak_joins_every_piece_and_reports_no_problem_for_a_normal_voice(voices):
    spoken = speak("First sentence is here. Second sentence is there.", voices["en-fake-m"])
    assert spoken.problems == [] and spoken.samples.size > spoken.sample_rate


def test_a_voice_that_stays_silent_is_marked_check(book, voices, cast_file, texts):
    voices["en-fake-m"] = Voice("en-fake-m", "en", "male", "fake", "test", {"silent": True})
    item = build_plan(book, voices, ["en"]).items[0]
    made = make(item, Manifest(book.slug, "en"))
    assert made.problems
    assert Manifest(book.slug, "en").get("meaning", "1.1.1")["status"] == "check"


def test_join_trims_and_pauses():
    sr = 1000
    tone = np.r_[np.zeros(500), np.ones(100) * 0.5, np.zeros(500)].astype(np.float32)
    out = audio.join([(tone, 200), (tone, 0)], sr)
    # each piece trimmed to 100 samples plus 60 ms kept on either side, and one 200 ms pause
    assert out.size == 2 * (100 + 2 * 60) + 200
